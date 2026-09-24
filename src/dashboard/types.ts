// Observex native dashboard schema. This is the shape every renderer, editor
// and storage layer works against. Grafana JSON is converted into this shape
// by src/dashboard/grafana/normalizer.ts before it ever reaches a component.

export type PanelType =
  | "row"
  | "stat"
  | "gauge"
  | "bargauge"
  | "timeseries"
  | "barchart"
  | "table"
  | "text"
  | "logs"
  | "heatmap"
  | "unsupported";

export interface GridPos {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PanelQuery {
  refId: string;
  expr: string;
  legend?: string;
  instant?: boolean;
}

export type ThresholdColor = "green" | "orange" | "red" | string;

export interface PanelThresholdStep {
  color: ThresholdColor;
  value: number | null;
}

export interface PanelFieldConfig {
  unit?: string;
  min?: number;
  max?: number;
  decimals?: number;
  thresholds?: PanelThresholdStep[];
  columns?: string[];
}

export interface PanelOptions {
  originalType?: string;
  [key: string]: unknown;
}

export interface ObservexPanel {
  id: number;
  title: string;
  description?: string;
  type: PanelType;
  gridPos: GridPos;
  targets: PanelQuery[];
  fieldConfig: PanelFieldConfig;
  options?: Record<string, unknown>;
  collapsed?: boolean;
}

export interface DashboardVariable {
  name: string;
  label?: string;
  type: "query" | "custom" | "interval";
  options: string[];
  current: string;
  multi?: boolean;
}

export interface DashboardTimeRange {
  from: string;
  to: string;
}

export type DashboardSource = "builtin" | "imported" | "user";

export interface ObservexDashboard {
  id: string;
  uid: string;
  title: string;
  description?: string;
  tags: string[];
  time: DashboardTimeRange;
  refresh: string;
  variables: DashboardVariable[];
  panels: ObservexPanel[];
  source: DashboardSource;
  createdAt: string;
  updatedAt: string;
}

export const TIME_RANGE_PRESETS: { label: string; value: string }[] = [
  { label: "Last 5 minutes", value: "now-5m" },
  { label: "Last 15 minutes", value: "now-15m" },
  { label: "Last 1 hour", value: "now-1h" },
  { label: "Last 6 hours", value: "now-6h" },
  { label: "Last 24 hours", value: "now-24h" },
];

export const REFRESH_PRESETS: { label: string; value: string }[] = [
  { label: "Off", value: "" },
  { label: "5s", value: "5s" },
  { label: "10s", value: "10s" },
  { label: "30s", value: "30s" },
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
];

export function emptyDashboard(title: string): ObservexDashboard {
  const now = new Date().toISOString();
  return {
    id: `dash-${Date.now()}`,
    uid: `dash-${Date.now()}`,
    title,
    tags: [],
    time: { from: "now-6h", to: "now" },
    refresh: "",
    variables: [],
    panels: [],
    source: "user",
    createdAt: now,
    updatedAt: now,
  };
}

let panelIdCounter = 1000;
export function nextPanelId(): number {
  panelIdCounter += 1;
  return panelIdCounter;
}

export function emptyPanel(type: PanelType, gridPos: GridPos): ObservexPanel {
  return {
    id: nextPanelId(),
    title: "New panel",
    type,
    gridPos,
    targets: [{ refId: "A", expr: "" }],
    fieldConfig: {},
  };
}
