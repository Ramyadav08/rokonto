"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Code2, SlidersHorizontal } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";
import { formatByUnit, formatClock } from "@/lib/format";
import { LogCorrelationTooltip } from "@/components/charts/LogCorrelationTooltip";
import { readChartClick, useLogDrilldown } from "@/lib/logCorrelation";
import { parsePromQL, AGGREGATION_OPTIONS, GROUP_BY_OPTIONS, type MetricQuery } from "@/lib/promqlQuery";
import { cn } from "@/lib/cn";
import type { DatasourceQueryResult, DatasourceSeries, DatasourceStatus } from "@/lib/datasource/types";
import { useSelectedCluster, withClusterParam } from "@/lib/clusterContext";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TIME_RANGE_PRESETS } from "@/dashboard/types";

const SERIES_COLORS = ["#3b82f6", "#8b5cf6", "#22c55e", "#eab308"];

// Our UI labels ("Average", "p95", ...) aren't real PromQL function names --
// map them to the actual aggregation operators Prometheus understands.
const PROMQL_AGGREGATION: Record<string, string> = {
  average: "avg",
  sum: "sum",
  max: "max",
  min: "min",
  p95: "quantile",
};

function toPromQLString(q: MetricQuery): string {
  // "all" is our own sentinel for "no filter on this field" -- it must never
  // be sent as a literal label value (container="all" would only match a
  // series that literally has that label, which no real metric does, so a
  // real datasource would just come back empty).
  const labels = (["container", "namespace", "pod"] as const)
    .filter((key) => q[key] !== "all")
    .map((key) => `${key}="${q[key]}"`)
    .join(",");
  const selector = labels ? `${q.metric}{${labels}}` : q.metric;
  const fn = PROMQL_AGGREGATION[q.aggregation.toLowerCase()] ?? q.aggregation.toLowerCase();
  const inner = fn === "quantile" ? `0.95, ${selector}` : selector;
  const by = q.groupBy !== "None" ? ` by (${q.groupBy.toLowerCase()})` : "";
  return `${fn}(${inner})${by}`;
}

/** One row per timestamp, one column per series -- what the chart expects. A single
    query_range call returns all its series on the same timestamp grid, so merging
    by exact time match is safe (no interpolation needed). */
function mergeSeriesForChart(series: DatasourceSeries[]): Record<string, number>[] {
  const byTime = new Map<number, Record<string, number>>();
  for (const s of series) {
    for (const p of s.points) {
      const row = byTime.get(p.time) ?? { time: p.time };
      row[s.name] = p.value;
      byTime.set(p.time, row);
    }
  }
  return Array.from(byTime.values()).sort((a, b) => a.time - b.time);
}

export function MetricsExplorer() {
  const { selectedCluster } = useSelectedCluster();
  const [mode, setMode] = useState<"builder" | "advanced">("builder");
  const [metric, setMetric] = useState("up");
  const [container, setContainer] = useState("all");
  const [namespace, setNamespace] = useState("all");
  const [pod, setPod] = useState("all");
  const [aggregation, setAggregation] = useState(AGGREGATION_OPTIONS[0]);
  const [groupBy, setGroupBy] = useState(GROUP_BY_OPTIONS[0]);
  const [timeRange, setTimeRange] = useState("now-1h");
  const [advancedQuery, setAdvancedQuery] = useState(() =>
    toPromQLString({ metric, container, namespace, pod, aggregation, groupBy })
  );

  const parsedAdvanced = useMemo(() => parsePromQL(advancedQuery), [advancedQuery]);
  const effectiveQuery: MetricQuery = useMemo(
    () => (mode === "advanced" ? parsedAdvanced.query : { metric, container, namespace, pod, aggregation, groupBy }),
    [mode, parsedAdvanced, metric, container, namespace, pod, aggregation, groupBy]
  );
  const queryText = mode === "advanced" ? advancedQuery : toPromQLString(effectiveQuery);

  // Real Prometheus-compatible datasource, via query-gateway. Checked once on
  // mount; a missing session or unreachable gateway just means no query runs
  // -- there is no mock fallback.
  const [dsStatus, setDsStatus] = useState<DatasourceStatus | null>(null);
  const [live, setLive] = useState<DatasourceQueryResult | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);

  useEffect(() => {
    fetch("/api/datasource/metrics/status")
      .then((r) => r.json())
      .then(setDsStatus)
      .catch(() => setDsStatus({ configured: false }));
  }, []);

  // Real label values for the Builder dropdowns. Null means "no real list
  // yet (or none configured)" -- rendered as just the "all" option, never a
  // fabricated list.
  const [liveMetricNames, setLiveMetricNames] = useState<string[] | null>(null);
  const [liveContainers, setLiveContainers] = useState<string[] | null>(null);
  const [liveNamespaces, setLiveNamespaces] = useState<string[] | null>(null);
  const [livePods, setLivePods] = useState<string[] | null>(null);

  useEffect(() => {
    if (!dsStatus?.configured) {
      setLiveMetricNames(null);
      return;
    }
    let cancelled = false;
    fetch(withClusterParam("/api/datasource/metrics/labels?label=__name__", selectedCluster))
      .then((r) => r.json())
      .then((res: { values: string[] }) => {
        if (!cancelled && res.values.length > 0) setLiveMetricNames(res.values);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [dsStatus, selectedCluster]);

  // The real metric-name list rarely contains any of the hardcoded mock
  // names (they're illustrative, not real Prometheus metrics), so once a
  // real list loads, point the selection at a real metric instead of one
  // that would just render an empty chart.
  useEffect(() => {
    if (liveMetricNames && liveMetricNames.length > 0 && !liveMetricNames.includes(metric)) {
      setMetric(liveMetricNames.includes("up") ? "up" : liveMetricNames[0]);
    }
  }, [liveMetricNames, metric]);

  // Each dropdown's options are scoped by whatever the OTHER dropdowns are
  // currently set to (excluding itself) -- e.g. picking Namespace="default"
  // narrows the Pod list to pods that actually exist in that namespace,
  // instead of always listing every pod across every namespace regardless
  // of what's selected. Container and Namespace scope each other the same
  // way; Pod is scoped by both (nothing else depends on Pod).
  useEffect(() => {
    if (!dsStatus?.configured || !metric) {
      setLiveContainers(null);
      setLiveNamespaces(null);
      setLivePods(null);
      return;
    }
    let cancelled = false;
    const selectorExcluding = (exclude: "container" | "namespace" | "none") => {
      const filters: string[] = [];
      if (exclude !== "container" && container !== "all") filters.push(`container="${container}"`);
      if (exclude !== "namespace" && namespace !== "all") filters.push(`namespace="${namespace}"`);
      return filters.length ? `${metric}{${filters.join(",")}}` : metric;
    };
    Promise.all(
      (
        [
          ["container", selectorExcluding("container")],
          ["namespace", selectorExcluding("namespace")],
          ["pod", selectorExcluding("none")],
        ] as const
      ).map(([label, selector]) =>
        fetch(withClusterParam(`/api/datasource/metrics/labels?label=${label}&metric=${encodeURIComponent(selector)}`, selectedCluster))
          .then((r) => r.json())
          .then((res: { values: string[] }) => res.values)
          .catch(() => [] as string[])
      )
    ).then(([ctr, ns, pd]) => {
      if (cancelled) return;
      setLiveContainers(ctr);
      setLiveNamespaces(ns);
      setLivePods(pd);
    });
    return () => {
      cancelled = true;
    };
  }, [dsStatus, metric, container, namespace, selectedCluster]);

  useEffect(() => {
    if (!dsStatus?.configured || !queryText.trim()) {
      setLive(null);
      return;
    }
    let cancelled = false;
    setLiveLoading(true);
    fetch(
      withClusterParam(
        `/api/datasource/metrics?query=${encodeURIComponent(queryText)}&range=${encodeURIComponent(timeRange)}`,
        selectedCluster
      )
    )
      .then((r) => r.json())
      .then((result: DatasourceQueryResult) => {
        if (!cancelled) setLive(result);
      })
      .catch((err) => {
        if (!cancelled) setLive({ status: "error", detail: err instanceof Error ? err.message : "Request failed." });
      })
      .finally(() => {
        if (!cancelled) setLiveLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dsStatus, queryText, timeRange, selectedCluster]);

  // A "connected" result with an empty series array is a real (if empty)
  // answer from the datasource -- render it as-is. Anything else (not
  // configured, still loading, or a genuine error) is shown as an explicit
  // status instead of silently swapping in mock numbers, which would defeat
  // the point of testing against a real datasource.
  const isLive = live?.status === "connected";
  const data = isLive ? mergeSeriesForChart(live?.series ?? []) : [];
  const seriesNames = isLive ? (live?.series ?? []).map((s) => s.name) : [];
  const goToLogs = useLogDrilldown();

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex rounded-md border border-border p-0.5 text-xs">
          <button
            onClick={() => setMode("builder")}
            className={cn("flex items-center gap-1.5 rounded px-2.5 py-1", mode === "builder" ? "bg-surface-hover text-text-primary" : "text-text-muted")}
          >
            <SlidersHorizontal className="h-3 w-3" />
            Builder
          </button>
          <button
            onClick={() => setMode("advanced")}
            className={cn("flex items-center gap-1.5 rounded px-2.5 py-1", mode === "advanced" ? "bg-surface-hover text-text-primary" : "text-text-muted")}
          >
            <Code2 className="h-3 w-3" />
            Advanced
          </button>
        </div>
        <DatasourceBadge dsStatus={dsStatus} live={live} loading={liveLoading} />
        <div className="ml-auto">
          <Select options={TIME_RANGE_PRESETS} value={timeRange} onChange={(e) => setTimeRange(e.target.value)} />
        </div>
      </div>

      {mode === "builder" ? (
        <Card className="mb-4 flex flex-wrap items-end gap-3 p-3">
          <Field label="Metric">
            <Select options={(liveMetricNames ?? []).map((m) => ({ label: m, value: m }))} value={metric} onChange={(e) => setMetric(e.target.value)} />
          </Field>
          <Field label="Container">
            <Select
              options={(liveContainers ? ["all", ...liveContainers] : ["all"]).map((c) => ({ label: c === "all" ? "All containers" : c, value: c }))}
              value={container}
              onChange={(e) => setContainer(e.target.value)}
            />
          </Field>
          <Field label="Namespace">
            <Select
              options={(liveNamespaces ? ["all", ...liveNamespaces] : ["all"]).map((n) => ({ label: n === "all" ? "All namespaces" : n, value: n }))}
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
            />
          </Field>
          <Field label="Pod">
            <Select
              options={(livePods ? ["all", ...livePods] : ["all"]).map((p) => ({ label: p === "all" ? "All pods" : p, value: p }))}
              value={pod}
              onChange={(e) => setPod(e.target.value)}
            />
          </Field>
          <Field label="Aggregation">
            <Select options={AGGREGATION_OPTIONS.map((a) => ({ label: a, value: a }))} value={aggregation} onChange={(e) => setAggregation(e.target.value)} />
          </Field>
          <Field label="Group by">
            <Select options={GROUP_BY_OPTIONS.map((g) => ({ label: g, value: g }))} value={groupBy} onChange={(e) => setGroupBy(e.target.value)} />
          </Field>
        </Card>
      ) : (
        <Card className="mb-4 p-3">
          <div className="mb-1.5 text-xs text-text-muted">
            PromQL-style query{dsStatus?.configured ? " -- runs against your live datasource" : " -- sign in to run this against your datasource"}
          </div>
          <input
            className="w-full rounded-md border border-border bg-surface-raised px-2.5 py-2 font-mono text-xs text-text-primary outline-none focus:border-accent-blue"
            value={advancedQuery}
            onChange={(e) => setAdvancedQuery(e.target.value)}
            spellCheck={false}
            placeholder='sum(container_cpu_usage{namespace="default"}) by (pod)'
          />
          <div className="mt-1.5 text-xs text-text-muted">
            {parsedAdvanced.recognized ? (
              <>
                Parsed as: metric <span className="text-text-secondary">{effectiveQuery.metric}</span>, aggregation{" "}
                <span className="text-text-secondary">{effectiveQuery.aggregation}</span>, group by{" "}
                <span className="text-text-secondary">{effectiveQuery.groupBy}</span>
                {effectiveQuery.container !== "all" && (
                  <>
                    , container <span className="text-text-secondary">{effectiveQuery.container}</span>
                  </>
                )}
              </>
            ) : (
              "Couldn't fully parse this as a query -- treating it as a bare metric name."
            )}
          </div>
        </Card>
      )}

      <Card className="min-h-[360px] flex-1 p-4">
        {!isLive ? (
          <div className="flex h-[360px] flex-col items-center justify-center gap-1.5 text-center text-sm text-text-muted">
            {!dsStatus?.configured ? (
              <>Not signed in</>
            ) : liveLoading || live === null ? (
              <>Loading…</>
            ) : (
              <>
                <span className="flex items-center gap-1.5 text-status-warning">
                  <AlertTriangle className="h-4 w-4" />
                  Datasource error
                </span>
                {live?.detail && <span className="max-w-md truncate text-xs">{live.detail}</span>}
              </>
            )}
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-[360px] flex-col items-center justify-center gap-1.5 text-center text-sm text-text-muted">
            No data for this query
          </div>
        ) : (
        <ResponsiveContainer width="100%" height={360}>
          <AreaChart
            data={data}
            margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
            className="cursor-pointer"
            onClick={(state) => {
              const click = readChartClick(state);
              if (click) goToLogs(click.timestamp, effectiveQuery.container !== "all" ? effectiveQuery.container : click.seriesName);
            }}
          >
            <CartesianGrid stroke="#1a2029" vertical={false} />
            <XAxis
              dataKey="time"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(v) => formatClock(v).slice(0, 5)}
              stroke="#6b7280"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#232a35" }}
              minTickGap={50}
            />
            <YAxis
              stroke="#6b7280"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(v) => formatByUnit(v, undefined, 0)}
            />
            <Tooltip
              content={({ active, label, payload }) =>
                active && label !== undefined && payload?.[0] ? (
                  <LogCorrelationTooltip
                    timestamp={Number(label)}
                    valueLine={`${payload[0].name}: ${formatByUnit(Number(payload[0].value), undefined, 2)}`}
                  />
                ) : null
              }
            />
            {seriesNames.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: "#9aa4b2" }} />}
            {seriesNames.map((name, i) => (
              <Area
                key={name}
                type="monotone"
                dataKey={name}
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                fillOpacity={0.12}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}

function DatasourceBadge({
  dsStatus,
  live,
  loading,
}: {
  dsStatus: DatasourceStatus | null;
  live: DatasourceQueryResult | null;
  loading: boolean;
}) {
  if (!dsStatus?.configured) {
    return <span className="text-xs text-text-muted">Not signed in</span>;
  }
  if (loading && !live) {
    return <span className="text-xs text-text-muted">Connecting…</span>;
  }
  if (live?.status === "connected") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-status-healthy" title={`Datasource: ${dsStatus.host}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-status-healthy" />
        Live{dsStatus.host ? ` · ${dsStatus.host}` : ""}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-status-warning" title={live?.detail ?? "No data returned"}>
      <AlertTriangle className="h-3 w-3" />
      Datasource error
    </span>
  );
}
