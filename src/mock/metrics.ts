import { generateTimeSeries, SeriesPoint } from "./generator";

export const METRIC_NAMES = [
  "container_cpu_usage",
  "container_memory_usage",
  "http_requests_total",
  "http_request_duration_seconds",
  "node_network_receive_bytes",
  "node_disk_io_time_seconds",
];

export const METRIC_SERVICES = [
  "all",
  "api-gateway",
  "voice-ai-agent",
  "dealer-tool",
  "order-service",
  "payment-service",
  "auth-service",
];

export const METRIC_NAMESPACES = ["all", "production", "staging", "data-platform"];

export const METRIC_PODS = ["all", "pod-1", "pod-2", "pod-3", "pod-4"];

export const AGGREGATIONS = ["Average", "Sum", "Max", "Min", "p95"];

export const GROUP_BY_OPTIONS = ["None", "Pod", "Namespace", "Service"];

export interface MetricQuery {
  metric: string;
  service: string;
  namespace: string;
  pod: string;
  aggregation: string;
  groupBy: string;
}

const UNIT_BY_METRIC: Record<string, string> = {
  container_cpu_usage: "percentunit",
  container_memory_usage: "bytes",
  http_requests_total: "none",
  http_request_duration_seconds: "s",
  node_network_receive_bytes: "binbps",
  node_disk_io_time_seconds: "s",
};

export function getMetricSeries(query: MetricQuery): SeriesPoint[] {
  const groupCount = query.groupBy === "None" ? 1 : 4;
  const names =
    query.groupBy === "Pod"
      ? ["pod-a", "pod-b", "pod-c", "pod-d"]
      : query.groupBy === "Namespace"
      ? ["production", "staging", "data-platform", "kube-system"]
      : query.groupBy === "Service"
      ? ["api-gateway", "order-service", "payment-service", "auth-service"]
      : [query.metric];

  const unit = UNIT_BY_METRIC[query.metric] ?? "none";
  return generateTimeSeries(
    `${query.metric}-${query.service}-${query.namespace}-${query.pod}-${query.aggregation}`,
    names.slice(0, groupCount),
    { unit },
    40
  );
}

export function unitForMetric(metric: string): string {
  return UNIT_BY_METRIC[metric] ?? "none";
}
