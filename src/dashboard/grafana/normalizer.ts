import {
  DashboardVariable,
  GridPos,
  ObservexDashboard,
  ObservexPanel,
  PanelFieldConfig,
  PanelQuery,
  PanelThresholdStep,
  PanelType,
} from "../types";
import { GrafanaDashboardJson, GrafanaPanelJson } from "./parser";

const TYPE_MAP: Record<string, PanelType> = {
  row: "row",
  stat: "stat",
  singlestat: "stat",
  gauge: "gauge",
  bargauge: "bargauge",
  timeseries: "timeseries",
  graph: "timeseries",
  barchart: "barchart",
  table: "table",
  "table-old": "table",
  text: "text",
  logs: "logs",
  heatmap: "heatmap",
};

function mapType(rawType: string | undefined): PanelType {
  if (!rawType) return "unsupported";
  return TYPE_MAP[rawType] ?? "unsupported";
}

function mapThresholds(
  steps: { color?: string; value?: number | null }[] | undefined
): PanelThresholdStep[] | undefined {
  if (!steps || steps.length === 0) return undefined;
  return steps.map((s) => ({ color: s.color ?? "green", value: s.value ?? null }));
}

function mapFieldConfig(panel: GrafanaPanelJson): PanelFieldConfig {
  const defaults = panel.fieldConfig?.defaults ?? {};
  const config: PanelFieldConfig = {
    unit: defaults.unit,
    min: defaults.min ?? undefined,
    max: defaults.max ?? undefined,
    decimals: defaults.decimals,
    thresholds: mapThresholds(defaults.thresholds?.steps),
  };

  // Best-effort column name extraction for table panels: prefer an
  // "organize" transformation's renameByName map (this is how the sample
  // Kubernetes dashboard labels its columns), falling back to override
  // matchers, and finally to raw target refIds.
  const transformations = (panel as unknown as {
    transformations?: Array<{ id?: string; options?: { renameByName?: Record<string, string> } }>;
  }).transformations;
  const organize = transformations?.find((t) => t.id === "organize");
  const renamed = organize?.options?.renameByName;
  if (renamed) {
    // Real-world exports sometimes rename two distinct source fields (e.g.
    // "namespace" and "namespace 12" after a merge transform) to the same
    // display name. Dedupe so we never render two columns with one label
    // (and never hand React two elements with the same key).
    const names = Array.from(new Set(Object.values(renamed).filter((v) => v && v.trim().length > 0)));
    if (names.length > 0) config.columns = names;
  }

  if (!config.columns) {
    const overrideNames = panel.fieldConfig?.overrides
      ?.map((o) => (o.matcher?.id === "byName" ? o.matcher.options : undefined))
      .filter((v): v is string => Boolean(v));
    if (overrideNames && overrideNames.length > 0) {
      config.columns = overrideNames;
    }
  }

  return config;
}

function mapTargets(panel: GrafanaPanelJson): PanelQuery[] {
  if (!panel.targets || panel.targets.length === 0) {
    return [{ refId: "A", expr: "" }];
  }
  return panel.targets.map((t, i) => ({
    refId: t.refId ?? String.fromCharCode(65 + i),
    expr: t.expr ?? "",
    legend: t.legendFormat,
    instant: t.instant,
  }));
}

function mapGridPos(gridPos: GrafanaPanelJson["gridPos"], fallbackY: number): GridPos {
  return {
    x: gridPos?.x ?? 0,
    y: gridPos?.y ?? fallbackY,
    w: gridPos?.w ?? 12,
    h: gridPos?.h ?? 8,
  };
}

function flattenPanels(panels: GrafanaPanelJson[]): GrafanaPanelJson[] {
  const flat: GrafanaPanelJson[] = [];
  for (const panel of panels) {
    flat.push(panel);
    if (panel.type === "row" && Array.isArray(panel.panels)) {
      flat.push(...flattenPanels(panel.panels));
    }
  }
  return flat;
}

function normalizePanel(panel: GrafanaPanelJson, index: number): ObservexPanel {
  const type = mapType(panel.type);
  return {
    id: panel.id ?? index + 1,
    title: panel.title ?? "Untitled panel",
    description: panel.description || undefined,
    type,
    gridPos: mapGridPos(panel.gridPos, index * 8),
    targets: type === "row" ? [] : mapTargets(panel),
    fieldConfig: mapFieldConfig(panel),
    options: { originalType: panel.type, ...(panel.options ?? {}) },
    collapsed: panel.collapsed,
  };
}

function normalizeVariables(raw: GrafanaDashboardJson): DashboardVariable[] {
  const list = raw.templating?.list ?? [];
  const variables: DashboardVariable[] = [];
  for (const v of list) {
    const type = v.type as string;
    if (type === "datasource") continue; // not applicable, no real datasources yet
    const options = Array.isArray(v.options)
      ? (v.options as Array<{ text?: string; value?: string }>)
          .map((o) => o.text ?? String(o.value ?? ""))
          .filter(Boolean)
      : [];
    const current = (v.current as { text?: string; value?: string } | undefined)?.text
      ?? options[0]
      ?? "All";
    variables.push({
      name: String(v.name ?? "var"),
      label: v.label ? String(v.label) : undefined,
      type: type === "custom" || type === "interval" ? type : "query",
      options: options.length > 0 ? options : ["All"],
      current,
      multi: Boolean(v.multi),
    });
  }
  return variables;
}

export interface NormalizeOptions {
  id: string;
  source: ObservexDashboard["source"];
}

export function normalizeDashboard(
  raw: GrafanaDashboardJson,
  opts: NormalizeOptions
): ObservexDashboard {
  const now = new Date().toISOString();
  const flatPanels = flattenPanels(raw.panels ?? []);

  return {
    id: opts.id,
    uid: raw.uid ?? opts.id,
    title: raw.title ?? "Imported dashboard",
    description: raw.description || undefined,
    tags: raw.tags ?? [],
    time: { from: raw.time?.from ?? "now-6h", to: raw.time?.to ?? "now" },
    refresh: typeof raw.refresh === "string" ? raw.refresh : "",
    variables: normalizeVariables(raw),
    panels: flatPanels.map(normalizePanel),
    source: opts.source,
    createdAt: now,
    updatedAt: now,
  };
}
