import { ObservexDashboard } from "@/dashboard/types";
import { parseGrafanaDashboard } from "@/dashboard/grafana/parser";
import { normalizeDashboard } from "@/dashboard/grafana/normalizer";

const STORAGE_KEY = "observex.dashboards.v1";

const BUILTIN_SOURCES: { id: string; url: string }[] = [
  { id: "kubernetes-dashboard", url: "/dashboards/kubernetes-dashboard.json" },
  { id: "node-exporter-full", url: "/dashboards/node-exporter-full.json" },
];

function readStorage(): Record<string, ObservexDashboard> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ObservexDashboard>) : {};
  } catch {
    return {};
  }
}

function writeStorage(map: Record<string, ObservexDashboard>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

let builtinCache: ObservexDashboard[] | null = null;

async function loadBuiltinDashboards(): Promise<ObservexDashboard[]> {
  if (builtinCache) return builtinCache;
  const results = await Promise.all(
    BUILTIN_SOURCES.map(async (src) => {
      try {
        const res = await fetch(src.url, { cache: "no-store" });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = await res.json();
        const raw = parseGrafanaDashboard(json);
        return normalizeDashboard(raw, { id: src.id, source: "builtin" });
      } catch (err) {
        console.error(`Failed to load builtin dashboard "${src.id}"`, err);
        return null;
      }
    })
  );
  builtinCache = results.filter((d): d is ObservexDashboard => d !== null);
  return builtinCache;
}

/** All dashboards: bundled defaults (with any local edits layered on top) + user-created/imported ones. */
export async function listDashboards(): Promise<ObservexDashboard[]> {
  const builtins = await loadBuiltinDashboards();
  const stored = readStorage();
  const merged = builtins.map((b) => stored[b.id] ?? b);
  const userOnly = Object.values(stored).filter((d) => !builtins.some((b) => b.id === d.id));
  return [...merged, ...userOnly];
}

export async function getDashboard(id: string): Promise<ObservexDashboard | undefined> {
  const all = await listDashboards();
  return all.find((d) => d.id === id);
}

export function saveDashboard(dashboard: ObservexDashboard): void {
  const stored = readStorage();
  stored[dashboard.id] = { ...dashboard, updatedAt: new Date().toISOString() };
  writeStorage(stored);
}

export function deleteDashboard(id: string): void {
  const stored = readStorage();
  if (stored[id]) {
    delete stored[id];
    writeStorage(stored);
  }
}

export function isUserManaged(dashboard: ObservexDashboard): boolean {
  return dashboard.source !== "builtin";
}

const OBSERVEX_EXPORT_MARKER = "observexSchemaVersion";

export interface ObservexDashboardExport extends ObservexDashboard {
  observexSchemaVersion: 1;
}

/** Wraps a dashboard for download. Re-importing this file skips Grafana normalization entirely. */
export function exportDashboardJson(dashboard: ObservexDashboard): ObservexDashboardExport {
  return { ...dashboard, observexSchemaVersion: 1 };
}

function isObservexExport(json: unknown): json is ObservexDashboardExport {
  return Boolean(json && typeof json === "object" && OBSERVEX_EXPORT_MARKER in (json as object));
}

/**
 * Parses + normalizes an arbitrary uploaded JSON file into a new imported
 * dashboard. Accepts either a native Observex export or a raw Grafana
 * dashboard JSON (routed through the Grafana normalizer). Throws on invalid
 * input.
 */
export function importDashboardJson(json: unknown): ObservexDashboard {
  const id = `imported-${Date.now()}`;
  const now = new Date().toISOString();

  if (isObservexExport(json)) {
    const { observexSchemaVersion: _drop, ...rest } = json;
    void _drop;
    const dashboard: ObservexDashboard = {
      ...rest,
      id,
      uid: id,
      source: "imported",
      createdAt: now,
      updatedAt: now,
    };
    saveDashboard(dashboard);
    return dashboard;
  }

  const raw = parseGrafanaDashboard(json);
  const dashboard = normalizeDashboard(raw, { id, source: "imported" });
  saveDashboard(dashboard);
  return dashboard;
}
