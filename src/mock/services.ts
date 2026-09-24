export interface Problem {
  id: string;
  title: string;
  target: string;
  severity: "critical" | "warning";
}

export function getRecentProblems(): Problem[] {
  return [
    { id: "prob-1", title: "High CPU", target: "voice-ai-agent", severity: "critical" },
    { id: "prob-2", title: "High error rate", target: "api-gateway", severity: "warning" },
    { id: "prob-3", title: "Pod restarting", target: "customer-service", severity: "warning" },
  ];
}
