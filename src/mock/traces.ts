export type TraceStatus = "OK" | "Error";

export interface TraceSpan {
  id: string;
  name: string;
  service: string;
  startOffsetMs: number;
  durationMs: number;
  status: TraceStatus;
  children: TraceSpan[];
}

export interface TraceSummary {
  traceId: string;
  service: string;
  operation: string;
  durationMs: number;
  status: TraceStatus;
  timestamp: number;
  spanCount: number;
}

export interface Trace extends TraceSummary {
  root: TraceSpan;
}

function hex(len: number): string {
  const chars = "abcdef0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const OPERATIONS = [
  { service: "api-gateway", operation: "POST /orders" },
  { service: "api-gateway", operation: "GET /catalog" },
  { service: "voice-ai-agent", operation: "POST /v1/session" },
  { service: "payment-service", operation: "POST /charge" },
  { service: "order-service", operation: "GET /orders/:id" },
];

function buildTrace(seedIndex: number): Trace {
  const { service, operation } = OPERATIONS[seedIndex % OPERATIONS.length];
  const status: TraceStatus = Math.random() < 0.18 ? "Error" : "OK";
  const totalDuration = Math.round(80 + Math.random() * 2500);

  const authSpan: TraceSpan = {
    id: hex(16),
    name: "auth-service",
    service: "auth-service",
    startOffsetMs: 4,
    durationMs: Math.round(totalDuration * 0.08),
    status: "OK",
    children: [],
  };
  const pgSpan1: TraceSpan = {
    id: hex(16),
    name: "postgres",
    service: "postgres",
    startOffsetMs: 20,
    durationMs: Math.round(totalDuration * 0.22),
    status: "OK",
    children: [],
  };
  const gatewaySpan: TraceSpan = {
    id: hex(16),
    name: "api-gateway",
    service: "api-gateway",
    startOffsetMs: 0,
    durationMs: Math.round(totalDuration * 0.4),
    status: "OK",
    children: [authSpan, pgSpan1],
  };

  const pgSpan2: TraceSpan = {
    id: hex(16),
    name: "postgres",
    service: "postgres",
    startOffsetMs: 10,
    durationMs: Math.round(totalDuration * 0.3),
    status: "OK",
    children: [],
  };
  const orderSpan: TraceSpan = {
    id: hex(16),
    name: "order-service",
    service: "order-service",
    startOffsetMs: Math.round(totalDuration * 0.42),
    durationMs: Math.round(totalDuration * 0.4),
    status: "OK",
    children: [pgSpan2],
  };

  const externalSpan: TraceSpan = {
    id: hex(16),
    name: "external-api",
    service: "external-api",
    startOffsetMs: 15,
    durationMs: Math.round(totalDuration * 0.5),
    status: status === "Error" ? "Error" : "OK",
    children: [],
  };
  const paymentSpan: TraceSpan = {
    id: hex(16),
    name: "payment-service",
    service: "payment-service",
    startOffsetMs: Math.round(totalDuration * 0.55),
    durationMs: Math.round(totalDuration * 0.42),
    status: status === "Error" ? "Error" : "OK",
    children: [externalSpan],
  };

  const root: TraceSpan = {
    id: hex(16),
    name: operation,
    service,
    startOffsetMs: 0,
    durationMs: totalDuration,
    status,
    children: [gatewaySpan, orderSpan, paymentSpan],
  };

  function countSpans(span: TraceSpan): number {
    return 1 + span.children.reduce((acc, c) => acc + countSpans(c), 0);
  }

  return {
    traceId: hex(32),
    service,
    operation,
    durationMs: totalDuration,
    status,
    timestamp: Date.now() - Math.floor(Math.random() * 15 * 60_000),
    spanCount: countSpans(root),
    root,
  };
}

let cachedTraces: Trace[] | null = null;

export function getTraces(): Trace[] {
  if (!cachedTraces) {
    cachedTraces = Array.from({ length: 40 }, (_, i) => buildTrace(i)).sort(
      (a, b) => b.timestamp - a.timestamp
    );
  }
  return cachedTraces;
}

export function getTraceById(id: string): Trace | undefined {
  return getTraces().find((t) => t.traceId === id);
}

export const TRACE_SERVICES = Array.from(new Set(OPERATIONS.map((o) => o.service)));
export const TRACE_OPERATIONS = OPERATIONS.map((o) => o.operation);
