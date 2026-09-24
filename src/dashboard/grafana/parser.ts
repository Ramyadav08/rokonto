// Loose, defensive parsing of Grafana dashboard JSON exports. Grafana exports
// come in two shapes: the "share externally" export (the dashboard object
// itself, sometimes with __inputs/__requires) and the API export (wrapped in
// { dashboard: {...}, meta: {...} }). This only extracts + validates enough
// structure to hand off to the normalizer -- it does not attempt to support
// every Grafana panel/plugin.

export interface GrafanaPanelJson {
  id?: number;
  title?: string;
  description?: string;
  type?: string;
  gridPos?: { x?: number; y?: number; w?: number; h?: number };
  targets?: Array<{
    refId?: string;
    expr?: string;
    legendFormat?: string;
    instant?: boolean;
  }>;
  fieldConfig?: {
    defaults?: {
      unit?: string;
      min?: number | null;
      max?: number | null;
      decimals?: number;
      thresholds?: { mode?: string; steps?: { color?: string; value?: number | null }[] };
    };
    overrides?: Array<{
      matcher?: { id?: string; options?: string };
      properties?: Array<{ id?: string; value?: unknown }>;
    }>;
  };
  options?: Record<string, unknown>;
  panels?: GrafanaPanelJson[];
  collapsed?: boolean;
}

export interface GrafanaDashboardJson {
  id?: number | null;
  uid?: string;
  title?: string;
  description?: string;
  tags?: string[];
  time?: { from?: string; to?: string };
  refresh?: string | boolean;
  templating?: { list?: Array<Record<string, unknown>> };
  panels?: GrafanaPanelJson[];
}

export class GrafanaParseError extends Error {}

/**
 * Accepts the raw text/object a user imports and returns the unwrapped
 * Grafana dashboard object, throwing GrafanaParseError if it doesn't look
 * like a dashboard at all.
 */
export function parseGrafanaDashboard(input: unknown): GrafanaDashboardJson {
  if (!input || typeof input !== "object") {
    throw new GrafanaParseError("Dashboard JSON must be an object.");
  }

  const obj = input as Record<string, unknown>;
  const candidate = (
    obj.dashboard && typeof obj.dashboard === "object" ? obj.dashboard : obj
  ) as Record<string, unknown>;

  if (!Array.isArray(candidate.panels)) {
    throw new GrafanaParseError(
      "Dashboard JSON is missing a top-level \"panels\" array."
    );
  }

  return candidate as GrafanaDashboardJson;
}
