export interface DatasourceSeriesPoint {
  time: number; // epoch ms
  value: number;
}

export interface DatasourceSeries {
  name: string;
  points: DatasourceSeriesPoint[];
  /** Display name for charts/legends/bars, client-side only (the server
      never sets this). Distinct from `name`: a dashboard panel's target can
      carry a real Grafana `legendFormat` (e.g. "Memory Usage" or
      "Inflow:{{node}}"), which is what a human should see, while `name`
      stays the raw label-based string that table-merge logic parses back
      into real label values. Falls back to `name` when no legend applies. */
  label?: string;
}

export type DatasourceQueryStatus = "connected" | "not_configured" | "error";

export interface DatasourceQueryResult {
  status: DatasourceQueryStatus;
  series?: DatasourceSeries[];
  detail?: string;
}

export interface DatasourceStatus {
  configured: boolean;
  /** Hostname only (never the full URL/credentials) -- safe to show in the UI. */
  host?: string;
}
