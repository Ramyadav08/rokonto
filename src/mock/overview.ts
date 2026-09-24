import { seededValue, generateTimeSeries } from "./generator";

export interface KpiTile {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "flat";
  tone: "healthy" | "warning" | "critical" | "neutral";
}

export function getKpiStrip(): KpiTile[] {
  return [
    { label: "Nodes Healthy", value: "10/10", delta: "no change", trend: "flat", tone: "healthy" },
    { label: "Pods Running", value: "209", delta: "+4 vs yesterday", trend: "up", tone: "healthy" },
    { label: "CPU Usage", value: "36.3%", delta: "+2.1% vs 1h ago", trend: "up", tone: "healthy" },
    { label: "Memory Usage", value: "40.5%", delta: "-1.4% vs 1h ago", trend: "down", tone: "healthy" },
    { label: "Error Rate", value: "0.6%", delta: "+0.2% vs 1h ago", trend: "up", tone: "warning" },
    { label: "Active Alerts", value: "3 firing", delta: "2 pending", trend: "flat", tone: "critical" },
    { label: "Deployments", value: "67/69", delta: "2 degraded", trend: "flat", tone: "warning" },
  ];
}

// ---- Resource usage flow (Sankey): Cluster -> Namespace -> Service ----

export interface SankeyNode {
  name: string;
}
export interface SankeyLink {
  source: number;
  target: number;
  value: number;
}
export interface ResourceFlowData {
  nodes: SankeyNode[];
  links: SankeyLink[];
  total: string;
}

const FLOW_NAMESPACES = ["production", "staging", "data-platform", "kube-system"];

const FLOW_SERVICES: Record<string, string[]> = {
  production: ["api-gateway", "voice-ai-agent", "payment-service"],
  staging: ["order-service", "auth-service"],
  "data-platform": ["notification-worker"],
  "kube-system": ["ingress-nginx-controller"],
};

export function getResourceFlow(metric: "cpu" | "memory"): ResourceFlowData {
  const nodes: SankeyNode[] = [{ name: "Cluster" }];
  const links: SankeyLink[] = [];
  const namespaceIndex: Record<string, number> = {};

  for (const ns of FLOW_NAMESPACES) {
    namespaceIndex[ns] = nodes.length;
    nodes.push({ name: ns });
  }

  let total = 0;
  for (const ns of FLOW_NAMESPACES) {
    let namespaceTotal = 0;
    for (const svc of FLOW_SERVICES[ns]) {
      const value = Math.round(seededValue(`flow-${metric}-${ns}-${svc}`, { min: 8, max: 60 }));
      namespaceTotal += value;
      const serviceIndex = nodes.length;
      nodes.push({ name: svc });
      links.push({ source: namespaceIndex[ns], target: serviceIndex, value });
    }
    links.push({ source: 0, target: namespaceIndex[ns], value: namespaceTotal });
    total += namespaceTotal;
  }

  return {
    nodes,
    links,
    total: metric === "cpu" ? `${total} cores` : `${(total / 4).toFixed(1)} GB`,
  };
}

// ---- Namespace breakdown + node distribution (replaces geo map) ----

export interface NamespaceRow {
  namespace: string;
  pods: number;
  cpuPercent: number;
  memPercent: number;
}

export function getNamespaceBreakdown(): NamespaceRow[] {
  return FLOW_NAMESPACES.map((ns) => ({
    namespace: ns,
    pods: Math.round(seededValue(`ns-pods-${ns}`, { min: 4, max: 80 })),
    cpuPercent: Number(seededValue(`ns-cpu-${ns}`, { unit: "percent" }).toFixed(1)),
    memPercent: Number(seededValue(`ns-mem-${ns}`, { unit: "percent" }).toFixed(1)),
  })).sort((a, b) => b.cpuPercent - a.cpuPercent);
}

export interface NodeUsage {
  node: string;
  percent: number;
}

export function getNodeDistribution(): NodeUsage[] {
  return Array.from({ length: 6 }, (_, i) => ({
    node: `node-${String(i + 1).padStart(2, "0")}`,
    percent: Number(seededValue(`node-dist-${i}`, { unit: "percent" }).toFixed(1)),
  })).sort((a, b) => b.percent - a.percent);
}

// ---- Volume trends ----

export const VOLUME_RANGES = ["1h", "6h", "24h"] as const;
export type VolumeRange = (typeof VOLUME_RANGES)[number];

const RANGE_POINTS: Record<VolumeRange, number> = { "1h": 30, "6h": 36, "24h": 48 };
const RANGE_STEP_MS: Record<VolumeRange, number> = {
  "1h": 2 * 60_000,
  "6h": 10 * 60_000,
  "24h": 30 * 60_000,
};

export function getVolumeSeries(kind: "requests" | "errors", range: VolumeRange) {
  const field = kind === "requests" ? { unit: "none", min: 900, max: 3200 } : { unit: "percent", min: 0.1, max: 5 };
  const name = kind === "requests" ? "Requests/min" : "Error Rate";
  return generateTimeSeries(`volume-${kind}-${range}`, [name], field, RANGE_POINTS[range], RANGE_STEP_MS[range]);
}

// ---- Top movers (services with the biggest usage change) ----

export type MoverStatus = "Healthy" | "Degraded" | "Critical";

export interface MoverRow {
  service: string;
  namespace: string;
  status: MoverStatus;
  previous: number;
  current: number;
  changePercent: number;
}

const MOVER_SERVICES: { service: string; namespace: string; status: MoverStatus }[] = [
  { service: "voice-ai-agent", namespace: "production", status: "Degraded" },
  { service: "api-gateway", namespace: "production", status: "Healthy" },
  { service: "payment-service", namespace: "production", status: "Healthy" },
  { service: "order-service", namespace: "production", status: "Healthy" },
  { service: "auth-service", namespace: "production", status: "Healthy" },
  { service: "customer-service", namespace: "production", status: "Critical" },
  { service: "notification-worker", namespace: "data-platform", status: "Healthy" },
];

export function getTopMovers(): MoverRow[] {
  return MOVER_SERVICES.map((s) => {
    const previous = seededValue(`mover-prev-${s.service}`, { min: 10, max: 85 });
    // Current is a bounded swing off the previous value, not an
    // independent random number -- keeps the "% change" column at
    // believable magnitudes instead of e.g. a coin-flip 300%+ jump.
    const swing = seededValue(`mover-swing-${s.service}`, { min: -0.4, max: 0.4 });
    const current = Math.min(99, Math.max(1, previous * (1 + swing)));
    const changePercent = ((current - previous) / previous) * 100;
    return {
      ...s,
      previous: Number(previous.toFixed(1)),
      current: Number(current.toFixed(1)),
      changePercent: Number(changePercent.toFixed(1)),
    };
  }).sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
}
