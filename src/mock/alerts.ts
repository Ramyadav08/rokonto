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

const now = Date.now();

const ALERTS: AlertItem[] = [
  {
    id: "alert-1",
    name: "High CPU",
    severity: "Critical",
    service: "voice-ai-agent",
    status: "Firing",
    description: "Container CPU usage has exceeded 90% of its limit for more than 5 minutes.",
    startedAt: now - 12 * 60_000,
    labels: { severity: "critical", namespace: "production", pod: "voice-ai-agent-7c9d4" },
    annotations: { runbook: "https://runbooks.internal/high-cpu", summary: "CPU usage sustained above threshold" },
  },
  {
    id: "alert-2",
    name: "High Error Rate",
    severity: "Warning",
    service: "api-gateway",
    status: "Firing",
    description: "5xx error rate has exceeded 3% over the last 5 minutes.",
    startedAt: now - 8 * 60_000,
    labels: { severity: "warning", namespace: "production", pod: "api-gateway-4f1a2" },
    annotations: { runbook: "https://runbooks.internal/error-rate", summary: "Elevated error rate on api-gateway" },
  },
  {
    id: "alert-3",
    name: "Pod CrashLooping",
    severity: "Critical",
    service: "customer-service",
    status: "Firing",
    description: "Pod has restarted more than 3 times in the last 10 minutes.",
    startedAt: now - 4 * 60_000,
    labels: { severity: "critical", namespace: "production", pod: "customer-service-9b3e1" },
    annotations: { runbook: "https://runbooks.internal/crashloop", summary: "customer-service pod is crash looping" },
  },
  {
    id: "alert-4",
    name: "Memory Pressure",
    severity: "Warning",
    service: "order-service",
    status: "Pending",
    description: "Memory usage approaching configured limit.",
    startedAt: now - 2 * 60_000,
    labels: { severity: "warning", namespace: "production", pod: "order-service-2a7c9" },
    annotations: { summary: "order-service memory usage trending up" },
  },
  {
    id: "alert-5",
    name: "Disk Usage High",
    severity: "Warning",
    service: "data-platform",
    status: "Pending",
    description: "Node disk usage above 80%.",
    startedAt: now - 60_000,
    labels: { severity: "warning", namespace: "data-platform", node: "node-07" },
    annotations: { summary: "Node disk usage climbing" },
  },
  ...Array.from({ length: 18 }, (_, i) => ({
    id: `alert-resolved-${i}`,
    name: ["Pod Restart", "Slow Query", "High Latency", "Connection Pool Exhausted", "OOMKilled"][i % 5],
    severity: (["Critical", "Warning", "Info"] as AlertSeverity[])[i % 3],
    service: ["api-gateway", "dealer-tool", "auth-service", "payment-service"][i % 4],
    status: "Resolved" as AlertStatusValue,
    description: "Alert condition cleared.",
    startedAt: now - (60 + i * 20) * 60_000,
    resolvedAt: now - (40 + i * 15) * 60_000,
    labels: { severity: "resolved", namespace: "production" },
    annotations: { summary: "Resolved automatically" },
  })),
];

export function getAlerts(): AlertItem[] {
  return ALERTS;
}

export function getAlertById(id: string): AlertItem | undefined {
  return ALERTS.find((a) => a.id === id);
}

export interface RecentProblem {
  id: string;
  title: string;
  target: string;
  severity: "critical" | "warning";
  cause: string;
}

/**
 * Overview's "Recent Problems" is just a glance at the most pressing firing
 * alerts -- derived here (instead of a separate hand-maintained mock list)
 * so the two views can never drift out of sync with each other, and so the
 * "cause" line is real alert copy rather than invented separately.
 */
export function getRecentProblems(limit = 3): RecentProblem[] {
  return ALERTS.filter((a) => a.status === "Firing")
    .slice(0, limit)
    .map((a) => ({
      id: a.id,
      title: a.name,
      target: a.service,
      severity: a.severity === "Critical" ? "critical" : "warning",
      cause: a.description,
    }));
}

export function formatDuration(startMs: number, endMs = Date.now()): string {
  const totalMinutes = Math.max(0, Math.floor((endMs - startMs) / 60_000));
  if (totalMinutes < 60) return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}
