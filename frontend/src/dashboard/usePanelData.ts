"use client";

import { useEffect, useState } from "react";
import { DashboardVariable, ObservexPanel } from "./types";
import type { DatasourceQueryResult, DatasourceSeries, DatasourceStatus } from "@/lib/datasource/types";
import { relativeRangeToSeconds, stepForRange } from "@/lib/datasource/timeRange";
import { useSelectedCluster, withClusterParam } from "@/lib/clusterContext";

const STATUS_TTL_MS = 10_000;
let statusCache: { value: DatasourceStatus; fetchedAt: number } | null = null;
let statusPromise: Promise<DatasourceStatus> | null = null;

/**
 * A dashboard can have 20+ panels, each wanting to know whether a real
 * datasource is configured before deciding to query it. A short TTL cache
 * plus in-flight dedupe means that's one status request per dashboard load
 * (or per TTL window), not one per panel.
 */
function getDatasourceStatus(): Promise<DatasourceStatus> {
  const now = Date.now();
  if (statusCache && now - statusCache.fetchedAt < STATUS_TTL_MS) {
    return Promise.resolve(statusCache.value);
  }
  if (!statusPromise) {
    statusPromise = fetch("/api/datasource/metrics/status")
      .then((r) => r.json())
      .catch(() => ({ configured: false }))
      .then((value: DatasourceStatus) => {
        statusCache = { value, fetchedAt: Date.now() };
        statusPromise = null;
        return value;
      });
  }
  return statusPromise;
}

export function useDatasourceStatus(): DatasourceStatus | null {
  const [status, setStatus] = useState<DatasourceStatus | null>(null);
  useEffect(() => {
    let cancelled = false;
    getDatasourceStatus().then((s) => {
      if (!cancelled) setStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return status;
}

export type PanelSeries = DatasourceSeries;

export interface UsePanelDataResult {
  /** "live" covers a genuinely connected result, including a real empty
      series (a real query with no matching data is still real, not an
      error). Every other state is surfaced explicitly instead of being
      papered over with mock numbers, so a broken datasource shows up as a
      broken datasource. */
  status: "live" | "loading" | "not_configured" | "error";
  series: PanelSeries[];
  /** Same series, kept separated by which target (refId) produced them --
      a flat merge loses this, but a multi-target table needs to know which
      value belongs to which query before it can rebuild Grafana's columns. */
  seriesByTarget: Record<string, PanelSeries[]>;
  detail?: string;
}

/** What a chart/legend/bar should show for a series -- its Grafana legend
    (already resolved from a template like "Inflow:{{node}}" if it had one),
    falling back to the raw label-based name. Table-merge code deliberately
    never uses this -- it needs the raw `name` to parse real label values
    back out. */
export function displayName(s: PanelSeries): string {
  return s.label ?? s.name;
}

function dedupeNames(series: PanelSeries[]): PanelSeries[] {
  const seen = new Map<string, number>();
  return series.map((s) => {
    const label = displayName(s);
    const count = seen.get(label) ?? 0;
    seen.set(label, count + 1);
    return count === 0 ? s : { ...s, label: `${label} (${count + 1})` };
  });
}

/** Grafana's `legendFormat` on a target is either a literal string ("Usage")
    or a template with `{{label}}` placeholders ("Inflow:{{node}}"), resolved
    per-series from that series' own real labels -- same convention Grafana
    itself uses, including leaving a placeholder blank when that series
    doesn't carry the referenced label. */
function applyLegendFormat(legend: string, seriesName: string): string {
  if (!legend.includes("{{")) return legend;
  const { labels } = parseSeriesLabels(seriesName);
  return legend.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => labels[key.toLowerCase()] ?? "");
}

/** One row per timestamp, one column per series -- the same shape TimeSeriesPanel's
    mock generateTimeSeries() produces, so it's a drop-in replacement. */
export function mergeSeriesByTime(series: PanelSeries[]): Record<string, number>[] {
  const byTime = new Map<number, Record<string, number>>();
  for (const s of series) {
    for (const p of s.points) {
      const row = byTime.get(p.time) ?? { time: p.time };
      row[displayName(s)] = p.value;
      byTime.set(p.time, row);
    }
  }
  return Array.from(byTime.values()).sort((a, b) => a.time - b.time);
}

export function latestValue(series: PanelSeries | undefined): number {
  if (!series || series.points.length === 0) return 0;
  return series.points[series.points.length - 1].value;
}

/** Pulls the label map back out of a formatted series name (`metric{k="v",...}`,
    as built by seriesNameFromLabels in prometheus.ts) so a table column that
    mirrors a real label name (e.g. "Namespace") can be filled from that label
    instead of the whole opaque series name. */
export function parseSeriesLabels(name: string): { metric: string; labels: Record<string, string> } {
  // seriesNameFromLabels (prometheus.ts) only wraps in "metric{...}" when the
  // query result kept a __name__ -- a `by (label)` aggregation strips it, so
  // the series name is a bare "label=\"value\",..." string with no braces at
  // all. Extracting labels must work on both shapes, not just the braced one.
  const braced = name.match(/^([^{]*)\{(.*)\}$/);
  const labelBlock = braced ? braced[2] : name;
  const labels: Record<string, string> = {};
  const re = /(\w+)="((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(labelBlock))) {
    labels[m[1].toLowerCase()] = m[2];
  }
  const metric = braced ? braced[1] : Object.keys(labels).length > 0 ? "" : name;
  return { metric, labels };
}

/**
 * Grafana builds a table like this by running N separate queries (one per
 * target/refId), each grouped `by (someLabel[, ...])`, then a "merge" or
 * "seriesToColumns" transform joins their results into one row per unique
 * combination of whichever labels are common across targets, and an
 * "organize" transform renames each target's value column and the join
 * labels themselves. `columnSources` (built by the normalizer from that
 * "organize" step) tells us, per display column, whether it's a raw label
 * or a specific target's value -- which is what makes reconstructing that
 * join possible from `seriesByTarget` instead of guessing by row position.
 */
function buildMergedTableRows(
  panel: ObservexPanel,
  columns: string[],
  columnSources: Record<string, { label?: string; refId?: string }>,
  seriesByTarget: Record<string, PanelSeries[]>
): Record<string, string | number>[] {
  // The join key is whatever label columns are common to every target that
  // actually returned series -- almost always just one label (e.g.
  // "container"), even when one target's `by (...)` also includes an extra
  // label the others don't (e.g. "namespace" appearing on only one target).
  const labelColumns = columns.filter((c) => columnSources[c]?.label);
  const targetsWithData = Object.values(seriesByTarget).filter((s) => s.length > 0);
  const joinLabels = labelColumns
    .map((c) => columnSources[c].label as string)
    .filter((label) => targetsWithData.every((series) => series.some((s) => label in parseSeriesLabels(s.name).labels)));

  const rows = new Map<string, Record<string, string | number>>();
  const keyFor = (labels: Record<string, string>) => joinLabels.map((l) => labels[l] ?? "").join("\u0000");

  for (const col of columns) {
    const source = columnSources[col];
    if (!source) continue;
    const targetSeries = source.refId ? seriesByTarget[source.refId] ?? [] : Object.values(seriesByTarget).flat();
    for (const s of targetSeries) {
      const { labels } = parseSeriesLabels(s.name);
      const key = keyFor(labels);
      const row = rows.get(key) ?? {};
      if (source.label) {
        if (labels[source.label] !== undefined) row[col] = labels[source.label];
      } else {
        row[col] = Number(latestValue(s).toFixed(2));
      }
      rows.set(key, row);
    }
  }

  return Array.from(rows.values()).map((row) => {
    const complete: Record<string, string | number> = {};
    columns.forEach((col) => {
      complete[col] = row[col] ?? "—";
    });
    return complete;
  });
}

/** Best-effort mapping of live series onto a table panel's configured columns.
    When the normalizer captured `columnSources` (a multi-target table with a
    real "organize" transform), reconstructs Grafana's own join-by-label
    behavior via `buildMergedTableRows`. Otherwise falls back to the simpler
    one-row-per-series heuristic: a column whose name matches a real label is
    filled from that label, the last column falls back to the series' latest
    value, and anything else falls back to the series name -- this covers
    single-target, label-shaped tables well. */
export function buildLiveTableRows(
  panel: ObservexPanel,
  series: PanelSeries[],
  seriesByTarget: Record<string, PanelSeries[]> = {}
): Record<string, string | number>[] {
  const columns = panel.fieldConfig.columns ?? ["Name", "Value"];
  const columnSources = panel.fieldConfig.columnSources;
  if (columnSources && Object.values(columnSources).some((s) => s.refId)) {
    return buildMergedTableRows(panel, columns, columnSources, seriesByTarget);
  }

  return series.map((s) => {
    const { metric, labels } = parseSeriesLabels(s.name);
    const row: Record<string, string | number> = {};
    columns.forEach((col, i) => {
      const key = col.toLowerCase();
      if (labels[key] !== undefined) {
        row[col] = labels[key];
      } else if (i === columns.length - 1) {
        row[col] = Number(latestValue(s).toFixed(2));
      } else if (i === 0) {
        row[col] = metric || s.name;
      } else {
        row[col] = "—";
      }
    });
    return row;
  });
}

const INSTANT_RANGE = "now-5m";

/**
 * Real Grafana dashboards reference their own dashboard variables (e.g.
 * "$node", "${Node}") and Grafana's built-in interval variables (e.g.
 * "$__rate_interval" inside `rate(...[$__rate_interval])`). Nothing in the
 * Grafana normalizer or the dashboard UI ever substituted these -- it never
 * mattered while panels only rendered mock data, but a real Prometheus will
 * either treat "$node" as a literal (never matching a real label value) or
 * reject "[$__rate_interval]" as an invalid duration outright. Grafana's own
 * convention for a variable's "All" value is a `.*` regex match (both sample
 * dashboards in this repo set `allValue: ".*"`), which is what an
 * unconfigured/unresolved dashboard variable normalizes to here.
 */
function resolveExprVariables(expr: string, variables: DashboardVariable[], timeRange: string, instant: boolean): string {
  let resolved = expr;
  for (const v of variables) {
    const value = v.current === "All" ? ".*" : v.current;
    const name = v.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const token = `(?:\\$\\{${name}\\}|\\$${name}\\b)`;

    // A wildcard value is only meaningful under a regex match (`=~`) --
    // substituting it into an exact match (`label="$var"`, the common shape
    // for a single-value variable like "$node" or "$job") would look for a
    // literal label value of ".*", which never exists on a real datasource.
    // Since there's no real label_values() resolution behind these
    // variables (every one defaults to "All"), upgrade the operator instead.
    resolved = resolved.replace(
      new RegExp(`(\\w+)(=~?)"${token}"`, "g"),
      (_m, label: string, op: string) => `${label}${value.includes(".*") ? "=~" : op}"${value}"`
    );
    resolved = resolved.replace(new RegExp(token, "g"), value);
  }

  const rangeSeconds = relativeRangeToSeconds(instant ? INSTANT_RANGE : timeRange);
  const stepSeconds = Math.max(15, stepForRange(rangeSeconds));
  const rateIntervalSeconds = Math.max(stepSeconds * 4, 60);
  resolved = resolved
    .replace(/\$__rate_interval\b/g, `${rateIntervalSeconds}s`)
    .replace(/\$__interval\b/g, `${stepSeconds}s`)
    .replace(/\$__range\b/g, `${rangeSeconds}s`);

  return resolved;
}

type FetchState = "idle" | "loading" | "loaded" | "errored";

/**
 * Real data for one dashboard panel. Unlike the earlier "always fall back to
 * mock" contract, every non-live state is reported explicitly -- "loading",
 * "not_configured" or "error" (with the real error detail) -- so a broken
 * datasource surfaces as a visible problem in the UI instead of being
 * silently masked by fabricated numbers that would defeat the point of
 * testing against a real cluster.
 */
export function usePanelData(panel: ObservexPanel, timeRange: string, variables: DashboardVariable[] = []): UsePanelDataResult {
  const dsStatus = useDatasourceStatus();
  const { selectedCluster } = useSelectedCluster();
  const [liveSeries, setLiveSeries] = useState<PanelSeries[] | null>(null);
  const [liveSeriesByTarget, setLiveSeriesByTarget] = useState<Record<string, PanelSeries[]>>({});
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [errorDetail, setErrorDetail] = useState<string | undefined>(undefined);

  const targets = panel.targets
    .filter((t) => t.expr.trim().length > 0)
    .map((t) => ({ ...t, expr: resolveExprVariables(t.expr, variables, timeRange, Boolean(t.instant)) }));
  const targetsKey = targets.map((t) => `${t.refId}:${t.expr}:${t.instant ? "1" : "0"}`).join("|");

  useEffect(() => {
    if (!dsStatus?.configured || targets.length === 0) {
      setLiveSeries(null);
      setLiveSeriesByTarget({});
      setFetchState("idle");
      return;
    }
    let cancelled = false;
    setFetchState("loading");
    Promise.all(
      targets.map((t) => {
        const range = t.instant ? INSTANT_RANGE : timeRange;
        return fetch(
          withClusterParam(`/api/datasource/metrics?query=${encodeURIComponent(t.expr)}&range=${encodeURIComponent(range)}`, selectedCluster)
        )
          .then((r) => r.json())
          .catch(
            (err): DatasourceQueryResult => ({
              status: "error",
              detail: err instanceof Error ? err.message : "Request failed.",
            })
          );
      })
    ).then((results: DatasourceQueryResult[]) => {
      if (cancelled) return;
      // Apply each target's own Grafana legend (if it had one) before
      // flattening -- once merged, a series no longer knows which target,
      // and therefore which legend, it came from.
      const labeled = results.map((r, i) => {
        if (r.status !== "connected") return r;
        const legend = targets[i].legend;
        const series = (r.series ?? []).map((s) => (legend ? { ...s, label: applyLegendFormat(legend, s.name) } : s));
        return { ...r, series };
      });
      const connected = labeled.filter((r) => r.status === "connected");
      if (connected.length === 0) {
        setLiveSeries(null);
        setLiveSeriesByTarget({});
        const firstError = results.find((r) => r.status === "error");
        setErrorDetail(firstError?.detail ?? "The datasource returned no usable result for this panel's query.");
        setFetchState("errored");
        return;
      }
      setLiveSeries(dedupeNames(connected.flatMap((r) => r.series ?? [])));
      const byTarget: Record<string, PanelSeries[]> = {};
      labeled.forEach((r, i) => {
        byTarget[targets[i].refId] = r.status === "connected" ? r.series ?? [] : [];
      });
      setLiveSeriesByTarget(byTarget);
      setFetchState("loaded");
    });
    return () => {
      cancelled = true;
    };
    // targetsKey is a stable fingerprint of every target field the fetch
    // depends on -- `targets` itself is a new array every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dsStatus, targetsKey, timeRange, selectedCluster]);

  if (dsStatus === null) {
    return { status: "loading", series: [], seriesByTarget: {} };
  }
  if (!dsStatus.configured) {
    return { status: "not_configured", series: [], seriesByTarget: {} };
  }
  if (targets.length === 0) {
    // Nothing to query -- e.g. a brand-new panel in the editor. Not a
    // datasource failure, so render it as a real (empty) result.
    return { status: "live", series: [], seriesByTarget: {} };
  }
  if (fetchState === "errored") {
    return { status: "error", series: [], seriesByTarget: {}, detail: errorDetail };
  }
  if (fetchState !== "loaded") {
    return { status: "loading", series: [], seriesByTarget: {} };
  }
  return { status: "live", series: liveSeries ?? [], seriesByTarget: liveSeriesByTarget };
}
