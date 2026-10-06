import type { DatasourceQueryResult, DatasourceSeries } from "./types";
import { queryGatewayUrl, sessionCookieHeader } from "@/lib/serverFetch";

// Relocated from the old src/lib/datasource/prometheus.ts and
// src/lib/datasource/alertmanager.ts, which talked to a raw Prometheus and
// Alertmanager URL directly. Both now go through the Go query-gateway, which
// enforces per-user RBAC before proxying to Mimir/Loki -- but it returns
// Mimir/Alertmanager's own untranslated JSON shape, so the translation logic
// that used to live in those two files now lives here instead.

interface MimirMatrixResult {
  metric: Record<string, string>;
  values: [number, string][];
}

interface MimirQueryRangeResponse {
  status: "success" | "error";
  data?: { resultType: string; result: MimirMatrixResult[] };
  error?: string;
}

interface MimirLabelValuesResponse {
  status: "success" | "error";
  data?: string[];
  error?: string;
}

/** Converts a Mimir/Prometheus `metric` label object into the app's display
    name convention: `name{k="v",...}`, or just the bare label block when the
    series has no `__name__` (e.g. after a `by (...)` aggregation strips it). */
export function seriesNameFromLabels(metric: Record<string, string>): string {
  const { __name__, ...rest } = metric;
  const labelPart = Object.entries(rest)
    .map(([k, v]) => `${k}="${v}"`)
    .join(",");
  if (__name__ && labelPart) return `${__name__}{${labelPart}}`;
  return __name__ || labelPart || "value";
}

/** `fetch` a query-gateway endpoint scoped to the caller's session. Returns
    `null` when there's no session token at all -- the caller decides what
    "not signed in" looks like in its own response shape, since every route
    that calls this already has an established not-configured/empty shape of
    its own to reuse instead of a bare 401. */
export async function fetchQueryGateway(path: string, params: URLSearchParams, token: string | undefined) {
  if (!token) return null;
  const url = `${queryGatewayUrl()}${path}?${params.toString()}`;
  return fetch(url, { headers: { Cookie: sessionCookieHeader(token) }, cache: "no-store" });
}

export async function queryRangeViaGateway(
  query: string,
  rangeSeconds: number,
  step: number,
  token: string | undefined,
  cluster?: string
): Promise<DatasourceQueryResult> {
  if (!token) {
    return { status: "not_configured", detail: "Not signed in." };
  }

  try {
    const end = Math.floor(Date.now() / 1000);
    const start = end - rangeSeconds;
    const params = new URLSearchParams({ query, start: String(start), end: String(end), step: String(step) });
    if (cluster) params.set("cluster", cluster);
    const res = await fetchQueryGateway("/metrics/query_range", params, token);
    if (!res) return { status: "not_configured", detail: "Not signed in." };
    if (res.status === 401) return { status: "not_configured", detail: "Session expired -- please sign in again." };
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
    }
    const json = (await res.json()) as MimirQueryRangeResponse;
    if (json.status !== "success") {
      throw new Error(json.error ?? "Query failed");
    }

    const series: DatasourceSeries[] = (json.data?.result ?? []).map((r) => ({
      name: seriesNameFromLabels(r.metric),
      points: r.values.map(([t, v]) => ({ time: t * 1000, value: Number(v) })),
    }));

    return { status: "connected", series };
  } catch (err) {
    return {
      status: "error",
      detail: err instanceof Error ? err.message : "Unknown error querying the metrics datasource.",
    };
  }
}

/** Real label values for a dropdown, scoped to the caller's clusters by
    query-gateway itself. Any failure (including "not signed in") just yields
    an empty list -- this is a supporting lookup for UI dropdowns, not the
    main query path, and an empty/loading dropdown is honest where a
    fabricated one would not be. */
export async function labelValuesViaGateway(
  label: string,
  matchQuery: string | undefined,
  token: string | undefined,
  cluster?: string
): Promise<string[]> {
  if (!token) return [];
  try {
    const params = new URLSearchParams({ label });
    if (matchQuery) params.set("metric", matchQuery);
    if (cluster) params.set("cluster", cluster);
    const res = await fetchQueryGateway("/metrics/label_values", params, token);
    if (!res || !res.ok) return [];
    const json = (await res.json()) as MimirLabelValuesResponse;
    if (json.status !== "success") return [];
    return json.data ?? [];
  } catch {
    return [];
  }
}

// ---- Logs (proxies Loki via query-gateway) ----

export type LogsQueryStatus = "connected" | "not_configured" | "error";

/** A real line Loki actually stored. `labels` carries Loki's real stream
    labels (`cluster`, `job`, `service_name`, `detected_level`) plus
    `namespace`/`pod`/`container` decomposed from the real `instance` label
    (see deriveLabelsFromInstance) -- there is no separate "service" label in
    the real pipeline, since that was invented by the old mock generator
    (deleted src/mock/logs.ts) and never corresponded to anything Loki
    actually stores. */
export interface LogEntry {
  id: string;
  timestamp: number; // epoch ms
  message: string;
  labels: Record<string, string>;
}

export interface LogsQueryResult {
  status: LogsQueryStatus;
  entries?: LogEntry[];
  detail?: string;
}

export type LogLevel = "ERROR" | "WARN" | "INFO" | "DEBUG";

/** Loki detects a level per line itself (the `detected_level` label) -- more
    reliable than guessing from the text ourselves, so it's used first. Its
    detector doesn't recognize every log format though (e.g. klog's "W..."
    prefix style comes back "unknown"), so this only falls back to scanning
    the real message text when Loki's own label didn't resolve to anything,
    never in place of it. */
export function realLogLevel(log: LogEntry): LogLevel {
  const detected = (log.labels.detected_level ?? "").toLowerCase();
  if (detected === "error" || detected === "critical" || detected === "fatal") return "ERROR";
  if (detected === "warn" || detected === "warning") return "WARN";
  if (detected === "info") return "INFO";
  if (detected === "debug" || detected === "trace") return "DEBUG";

  const m = log.message.toLowerCase();
  if (/\berror\b|panic|exception|fail(ed|ure)?/.test(m)) return "ERROR";
  if (/\bwarn(ing)?\b|retry|timeout|throttl/.test(m)) return "WARN";
  return "INFO";
}

interface LokiStreamResult {
  stream: Record<string, string>;
  values: [string, string][]; // [epoch-nanoseconds as string, line]
}

interface LokiQueryRangeResponse {
  status: "success" | "error";
  data?: { resultType: string; result: LokiStreamResult[] };
  error?: string;
}

/** The cluster-agent's Alloy config (backend/deploy/cluster-agent/values.yaml)
    has no relabeling step that promotes Kubernetes pod discovery metadata
    into separate `namespace`/`pod`/`container` Loki labels -- confirmed by
    querying Loki directly, the real labels on every stream are just
    `cluster`, `job`, `service_name`, `detected_level`, and a single
    `instance` label shaped like "kube-system/etcd-minikube:etcd". Rather
    than inventing namespace/pod/container values, this decomposes that one
    real label -- same information, just split back out for filtering/
    display, with nothing made up. */
function deriveLabelsFromInstance(instance: string | undefined): Record<string, string> {
  if (!instance) return {};
  const slash = instance.indexOf("/");
  if (slash === -1) return {};
  const namespace = instance.slice(0, slash);
  const rest = instance.slice(slash + 1);
  const colon = rest.lastIndexOf(":");
  if (colon === -1) return { namespace, pod: rest };
  return { namespace, pod: rest.slice(0, colon), container: rest.slice(colon + 1) };
}

/** Queries real log lines via query-gateway's /logs/query_range (proxies
    Loki, RBAC-scoped the same way metrics are). `query` must be a LogQL
    stream selector -- an empty one (`{}`) is valid and lets query-gateway's
    ScopeLogQL fill in the caller's cluster/namespace matchers itself.
    `endMs` defaults to now, so passing it explicitly is only needed for the
    "logs around this instant" drilldown from a chart click. */
export async function logsRangeViaGateway(
  query: string,
  rangeSeconds: number,
  limit: number,
  token: string | undefined,
  cluster?: string,
  endMs?: number
): Promise<LogsQueryResult> {
  if (!token) {
    return { status: "not_configured", detail: "Not signed in." };
  }

  try {
    const endNs = BigInt(endMs ?? Date.now()) * BigInt(1_000_000);
    const startNs = endNs - BigInt(rangeSeconds) * BigInt(1_000_000_000);
    const params = new URLSearchParams({
      query,
      start: startNs.toString(),
      end: endNs.toString(),
      limit: String(limit),
      direction: "backward",
    });
    if (cluster) params.set("cluster", cluster);
    const res = await fetchQueryGateway("/logs/query_range", params, token);
    if (!res) return { status: "not_configured", detail: "Not signed in." };
    if (res.status === 401) return { status: "not_configured", detail: "Session expired -- please sign in again." };
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
    }
    const json = (await res.json()) as LokiQueryRangeResponse;
    if (json.status !== "success") {
      throw new Error(json.error ?? "Query failed");
    }

    const entries: LogEntry[] = [];
    for (const stream of json.data?.result ?? []) {
      const labels = { ...stream.stream, ...deriveLabelsFromInstance(stream.stream.instance) };
      for (const [tsNano, line] of stream.values) {
        entries.push({
          id: `${tsNano}-${entries.length}`,
          timestamp: Math.floor(Number(BigInt(tsNano) / BigInt(1_000_000))),
          message: line,
          labels,
        });
      }
    }
    entries.sort((a, b) => b.timestamp - a.timestamp);

    return { status: "connected", entries };
  } catch (err) {
    return {
      status: "error",
      detail: err instanceof Error ? err.message : "Unknown error querying the logs datasource.",
    };
  }
}

interface LokiLabelValuesResponse {
  status: "success" | "error";
  data?: string[];
  error?: string;
}

/** The complete set of a Loki label's distinct values, independent of any
    time window or result limit -- used to populate the Namespace/Container
    dropdowns from every real value that exists, not just whatever happened
    to be in the most recently fetched log lines (a quiet workload can get
    crowded out of "last N lines" by a noisy one, which isn't a real absence,
    just a sampling artifact). Only `instance` is a real queryable Loki
    label (see deriveLabelsFromInstance) -- namespace/container dropdown
    options are derived by decomposing every instance value the same way. */
export async function logInstanceValuesViaGateway(token: string | undefined, cluster?: string): Promise<string[]> {
  if (!token) return [];
  try {
    const params = new URLSearchParams({ label: "instance" });
    if (cluster) params.set("cluster", cluster);
    const res = await fetchQueryGateway("/logs/label_values", params, token);
    if (!res || !res.ok) return [];
    const json = (await res.json()) as LokiLabelValuesResponse;
    if (json.status !== "success") return [];
    return json.data ?? [];
  } catch {
    return [];
  }
}

export { deriveLabelsFromInstance };

// ---- Alerts (proxies Mimir's built-in Alertmanager via query-gateway) ----

export type AlertSeverity = "Critical" | "Warning" | "Info";
export type AlertStatusValue = "Firing" | "Pending" | "Resolved";

export interface AlertItem {
  id: string;
  name: string;
  severity: AlertSeverity;
  service: string;
  status: AlertStatusValue;
  description: string;
  startedAt: number;
  resolvedAt?: number;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

// Alerts are discrete objects, not time series, so they don't fit
// DatasourceQueryResult's `series` shape -- a small, honest type of its own
// instead of force-fitting the metrics shape.
export type AlertsQueryStatus = "connected" | "not_configured" | "error";

export interface AlertsQueryResult {
  status: AlertsQueryStatus;
  alerts?: AlertItem[];
  detail?: string;
}

interface AlertmanagerAlert {
  labels: Record<string, string>;
  annotations: Record<string, string>;
  status: { state: "active" | "suppressed" | "unprocessed" };
  startsAt: string;
  endsAt: string;
  fingerprint: string;
}

function mapSeverity(labels: Record<string, string>): AlertSeverity {
  const sev = (labels.severity ?? "").toLowerCase();
  if (sev === "critical") return "Critical";
  if (sev === "warning") return "Warning";
  return "Info";
}

/** Alertmanager keeps a resolved alert around briefly with `endsAt` set to
    when it resolved (in the past) -- that's a more meaningful "Resolved"
    signal than `status.state`, which only distinguishes active/suppressed/
    unprocessed and has no "resolved" value of its own. */
function mapStatus(alert: AlertmanagerAlert): AlertStatusValue {
  const endsAt = Date.parse(alert.endsAt);
  if (!Number.isNaN(endsAt) && endsAt <= Date.now()) return "Resolved";
  if (alert.status.state === "active") return "Firing";
  return "Pending";
}

function mapAlert(alert: AlertmanagerAlert): AlertItem {
  const { labels, annotations } = alert;
  const startedAt = Date.parse(alert.startsAt);
  const status = mapStatus(alert);
  const endsAt = Date.parse(alert.endsAt);

  return {
    id: alert.fingerprint,
    name: labels.alertname ?? "Unknown alert",
    severity: mapSeverity(labels),
    service: labels.service ?? labels.namespace ?? labels.job ?? labels.instance ?? "unknown",
    status,
    description: annotations.description ?? annotations.summary ?? "No description provided.",
    startedAt: Number.isNaN(startedAt) ? Date.now() : startedAt,
    resolvedAt: status === "Resolved" && !Number.isNaN(endsAt) ? endsAt : undefined,
    labels,
    annotations,
  };
}

export interface RecentProblem {
  id: string;
  title: string;
  target: string;
  severity: "critical" | "warning";
  cause: string;
}

/** Overview's "Recent Problems" is just a glance at the most pressing firing
    alerts, from the same real alert list the Alerts page uses -- so the two
    can never drift out of sync, and the "cause" line is real alert copy
    rather than invented separately. Relocated from src/mock/alerts.ts, which
    had no mock data of its own here (it just re-exported this transform). */
export function toRecentProblems(alerts: AlertItem[], limit = 3): RecentProblem[] {
  return alerts
    .filter((a) => a.status === "Firing")
    .slice(0, limit)
    .map((a) => ({
      id: a.id,
      title: a.name,
      target: a.service,
      severity: a.severity === "Critical" ? "critical" : "warning",
      cause: a.description,
    }));
}

export async function fetchAlertsViaGateway(token: string | undefined, cluster?: string): Promise<AlertsQueryResult> {
  if (!token) {
    return { status: "not_configured", detail: "Not signed in." };
  }

  try {
    const params = new URLSearchParams();
    if (cluster) params.set("cluster", cluster);
    const res = await fetchQueryGateway("/alerts", params, token);
    if (!res) return { status: "not_configured", detail: "Not signed in." };
    if (res.status === 401) return { status: "not_configured", detail: "Session expired -- please sign in again." };
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
    }
    const json = (await res.json()) as AlertmanagerAlert[];
    return { status: "connected", alerts: json.map(mapAlert) };
  } catch (err) {
    return {
      status: "error",
      detail: err instanceof Error ? err.message : "Unknown error querying alerts.",
    };
  }
}
