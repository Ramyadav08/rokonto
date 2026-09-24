import { seededRandom } from "./generator";

export type LogLevel = "ERROR" | "WARN" | "INFO" | "DEBUG";

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  service: string;
  namespace: string;
  pod: string;
  container: string;
  message: string;
  traceId: string;
  spanId: string;
  labels: Record<string, string>;
}

const SERVICES = [
  "api-gateway",
  "voice-ai-agent",
  "dealer-tool",
  "order-service",
  "payment-service",
  "auth-service",
  "customer-service",
];

const NAMESPACES = ["production", "staging", "data-platform"];

const TEMPLATES: { level: LogLevel; message: string }[] = [
  { level: "ERROR", message: "request failed: upstream timeout" },
  { level: "ERROR", message: "database connection refused" },
  { level: "ERROR", message: "panic recovered: nil pointer dereference" },
  { level: "ERROR", message: "failed to publish event to queue" },
  { level: "WARN", message: "connection pool utilization: 91%" },
  { level: "WARN", message: "retrying request after 503 from downstream" },
  { level: "WARN", message: "slow query detected (842ms)" },
  { level: "WARN", message: "rate limit approaching threshold" },
  { level: "INFO", message: "request completed" },
  { level: "INFO", message: "health check passed" },
  { level: "INFO", message: "cache warmed successfully" },
  { level: "INFO", message: "deployment rollout completed" },
  { level: "DEBUG", message: "cache miss for key user:8123" },
  { level: "DEBUG", message: "dispatching handler for /v1/orders" },
];

function hex(len: number): string {
  const chars = "abcdef0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function seededHex(seedKey: string, len: number): string {
  const chars = "abcdef0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(seededRandom(`${seedKey}-${i}`) * chars.length)];
  return out;
}

const SEVERE_TEMPLATES = TEMPLATES.filter((t) => t.level === "ERROR" || t.level === "WARN");

let cachedLogs: LogEntry[] | null = null;

export function generateLogs(count = 400): LogEntry[] {
  const now = Date.now();
  const logs: LogEntry[] = [];
  for (let i = 0; i < count; i++) {
    const template = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
    const service = SERVICES[Math.floor(Math.random() * SERVICES.length)];
    const namespace = NAMESPACES[Math.floor(Math.random() * NAMESPACES.length)];
    logs.push({
      id: `log-${i}-${hex(6)}`,
      timestamp: now - Math.floor(Math.random() * 15 * 60_000),
      level: template.level,
      service,
      namespace,
      pod: `${service}-${hex(5)}`,
      container: service,
      message: template.message,
      traceId: hex(32),
      spanId: hex(16),
      labels: {
        app: service,
        env: namespace,
        version: `v1.${Math.floor(Math.random() * 20)}.0`,
      },
    });
  }
  return logs.sort((a, b) => b.timestamp - a.timestamp);
}

export function getLogs(): LogEntry[] {
  if (!cachedLogs) cachedLogs = generateLogs();
  return cachedLogs;
}

/**
 * Synthesizes a burst of log entries clustered around a specific instant --
 * used to answer "what happened here" when a user clicks a point on a
 * metric chart. Deterministic per (timestamp, hint) so the same point
 * always correlates to the same logs, independent of when the metric chart
 * itself happened to be rendered (its own mock series is regenerated on
 * every render relative to "now", so we can't just filter the global log
 * pool by proximity -- it may not cover that instant at all).
 */
export function generateLogsAround(timestamp: number, hint?: string, count = 14): LogEntry[] {
  const knownService = SERVICES.find((s) => hint?.toLowerCase().includes(s.toLowerCase()));
  const seedBase = `around-${Math.round(timestamp / 1000)}-${hint ?? ""}`;

  const logs: LogEntry[] = [];
  for (let i = 0; i < count; i++) {
    const seedKey = `${seedBase}-${i}`;
    const offsetMs = Math.round((seededRandom(`${seedKey}-offset`) - 0.5) * 10 * 60_000);
    const useSevere = seededRandom(`${seedKey}-severity`) < 0.65;
    const pool = useSevere ? SEVERE_TEMPLATES : TEMPLATES;
    const template = pool[Math.floor(seededRandom(`${seedKey}-template`) * pool.length)];
    const service = knownService ?? SERVICES[Math.floor(seededRandom(`${seedKey}-svc`) * SERVICES.length)];
    const namespace = NAMESPACES[Math.floor(seededRandom(`${seedKey}-ns`) * NAMESPACES.length)];

    logs.push({
      id: `around-${seedKey}`,
      timestamp: timestamp + offsetMs,
      level: template.level,
      service,
      namespace,
      pod: `${service}-${seededHex(seedKey, 5)}`,
      container: service,
      message: template.message,
      traceId: seededHex(`${seedKey}-trace`, 32),
      spanId: seededHex(`${seedKey}-span`, 16),
      labels: { app: service, env: namespace, version: "v1.4.0" },
    });
  }
  return logs.sort((a, b) => b.timestamp - a.timestamp);
}

export interface LogFilters {
  service?: string;
  namespace?: string;
  level?: string;
  search?: string;
}

export function filterLogs(logs: LogEntry[], filters: LogFilters): LogEntry[] {
  return logs.filter((log) => {
    if (filters.service && filters.service !== "all" && log.service !== filters.service) return false;
    if (filters.namespace && filters.namespace !== "all" && log.namespace !== filters.namespace) return false;
    if (filters.level && filters.level !== "all" && log.level !== filters.level) return false;
    if (filters.search) {
      const needle = filters.search.toLowerCase();
      const haystack = `${log.message} ${log.service}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}

export const LOG_SERVICES = SERVICES;
export const LOG_NAMESPACES = NAMESPACES;
