// Deterministic pseudo-random mock data for dashboard panels. Panels are
// rendered from arbitrary (possibly imported) Grafana JSON that references
// PromQL queries we have no backend for, so instead of trying to "run" the
// query we derive a stable, plausible-looking value/series from the query
// string + panel id. Same panel always looks the same between renders,
// refresh just nudges the walk forward.

import { ObservexPanel, PanelFieldConfig } from "@/dashboard/types";

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let s = seed;
  return function random() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A single deterministic pseudo-random value in [0, 1) for an arbitrary seed key. */
export function seededRandom(seedKey: string): number {
  return mulberry32(hashSeed(seedKey))();
}

function defaultRangeForUnit(unit?: string): [number, number] {
  switch (unit) {
    case "percentunit":
      return [0.05, 0.95];
    case "percent":
      return [5, 95];
    case "bytes":
      return [2e8, 4e9];
    case "binbps":
    case "bps":
      return [5e6, 4e8];
    case "s":
      return [0.01, 3];
    case "ms":
      return [5, 900];
    case "none":
    default:
      return [5, 500];
  }
}

function rangeFor(field: PanelFieldConfig): [number, number] {
  const [defMin, defMax] = defaultRangeForUnit(field.unit);
  return [field.min ?? defMin, field.max ?? defMax];
}

export function seededValue(seedKey: string, field: PanelFieldConfig = {}): number {
  const [min, max] = rangeFor(field);
  const rnd = mulberry32(hashSeed(seedKey))();
  // bias toward the lower-middle of the range so dashboards read as mostly
  // healthy, with the occasional hot panel.
  const biased = Math.pow(rnd, 1.3);
  return min + biased * (max - min);
}

export interface SeriesPoint {
  time: number;
  [series: string]: number;
}

export function generateTimeSeries(
  seedKey: string,
  seriesNames: string[],
  field: PanelFieldConfig = {},
  points = 30,
  stepMs = 60_000
): SeriesPoint[] {
  const [min, max] = rangeFor(field);
  const now = Date.now();
  const names = seriesNames.length > 0 ? seriesNames : ["value"];

  const walkers = names.map((name) => {
    const rnd = mulberry32(hashSeed(seedKey + name));
    const value = min + rnd() * (max - min);
    return { name, rnd, value };
  });

  const out: SeriesPoint[] = [];
  for (let i = 0; i < points; i++) {
    const point: SeriesPoint = { time: now - (points - 1 - i) * stepMs };
    for (const w of walkers) {
      const drift = (w.rnd() - 0.5) * (max - min) * 0.12;
      const meanRevert = (min + (max - min) * 0.4 - w.value) * 0.05;
      w.value = Math.min(max, Math.max(min, w.value + drift + meanRevert));
      point[w.name] = Number(w.value.toFixed(4));
    }
    out.push(point);
  }
  return out;
}

export function seriesNamesForPanel(panel: ObservexPanel): string[] {
  // "__auto" is Grafana's placeholder meaning "derive the legend from field
  // labels at query time" -- we have no query engine, so treat it as unset
  // and fall back to the target's refId, same as an empty legend.
  const raw = panel.targets
    .map((t) => (t.legend && t.legend !== "__auto" ? t.legend : t.refId))
    .filter((v): v is string => Boolean(v));
  const base = raw.length > 0 ? raw : [panel.title];

  // Real dashboard exports frequently reuse the same legend template (or
  // "__auto") across several targets in one panel. Names must stay unique --
  // they become both React keys and Recharts dataKeys, so a collision would
  // silently drop a series, not just mislabel it.
  const seen = new Map<string, number>();
  return base.map((name) => {
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    return count === 0 ? name : `${name} (${count + 1})`;
  });
}

const NAMESPACES = [
  "production",
  "staging",
  "kube-system",
  "monitoring",
  "ingress-nginx",
  "data-platform",
  "customer-service",
];

const PODS = [
  "api-gateway",
  "voice-ai-agent",
  "dealer-tool",
  "order-service",
  "payment-service",
  "auth-service",
  "customer-service",
  "notification-worker",
];

export function generateTableRows(panel: ObservexPanel): Record<string, string | number>[] {
  const columns = panel.fieldConfig.columns ?? ["Name", "Value"];
  const rowCount = 6;
  const rows: Record<string, string | number>[] = [];
  const nameSource = /namespace/i.test(columns[0] ?? "") || /space/i.test(columns[0] ?? "")
    ? NAMESPACES
    : PODS;

  for (let i = 0; i < rowCount; i++) {
    const row: Record<string, string | number> = {};
    columns.forEach((col, colIdx) => {
      if (colIdx === 0) {
        row[col] = nameSource[i % nameSource.length];
        return;
      }
      row[col] = Math.round(
        seededValue(`${panel.id}-${col}-${i}`, { min: 0, max: 240 })
      );
    });
    rows.push(row);
  }
  return rows;
}
