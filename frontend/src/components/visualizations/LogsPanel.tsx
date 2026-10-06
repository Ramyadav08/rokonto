"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { ObservexPanel } from "@/dashboard/types";
import { realLogLevel, type LogEntry } from "@/lib/datasource/queryGateway";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useSelectedCluster, withClusterParam } from "@/lib/clusterContext";

type PanelState = { status: "loading" } | { status: "error"; detail: string } | { status: "not_configured" } | { status: "loaded"; logs: LogEntry[] };

const LEVEL_COLOR: Record<string, string> = {
  ERROR: "text-status-critical",
  WARN: "text-status-warning",
  INFO: "text-status-info",
  DEBUG: "text-text-muted",
};

export function LogsPanel({ panel }: { panel: ObservexPanel }) {
  const { selectedCluster } = useSelectedCluster();
  const [state, setState] = useState<PanelState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetch(withClusterParam("/api/datasource/logs?range=now-15m&limit=40", selectedCluster))
      .then((r) => r.json())
      .then((result: { status: string; entries?: LogEntry[]; detail?: string }) => {
        if (cancelled) return;
        if (result.status === "not_configured") {
          setState({ status: "not_configured" });
          return;
        }
        if (result.status !== "connected") {
          setState({ status: "error", detail: result.detail ?? "Could not load logs." });
          return;
        }
        setState({ status: "loaded", logs: result.entries ?? [] });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ status: "error", detail: err instanceof Error ? err.message : "Could not reach the server." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCluster]);

  if (state.status === "loading") {
    return (
      <div className="flex h-full items-center gap-1.5 p-3 text-xs text-text-muted" data-panel-id={panel.id}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading…
      </div>
    );
  }
  if (state.status === "not_configured") {
    return (
      <div className="flex h-full items-center justify-center p-3 text-xs text-text-muted" data-panel-id={panel.id}>
        Not signed in.
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="flex h-full items-center justify-center gap-1.5 p-3 text-xs text-status-critical" data-panel-id={panel.id}>
        <AlertTriangle className="h-3.5 w-3.5" />
        {state.detail}
      </div>
    );
  }
  if (state.logs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-3 text-xs text-text-muted" data-panel-id={panel.id}>
        No logs reported yet.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto font-mono text-xs" data-panel-id={panel.id}>
      {state.logs.map((log) => {
        const level = realLogLevel(log);
        return (
          <div key={log.id} className="flex gap-2 border-b border-border/40 px-1 py-1">
            <span className="shrink-0 text-text-muted">{formatClock(log.timestamp)}</span>
            <span className={cn("w-10 shrink-0 font-medium", LEVEL_COLOR[level])}>{level}</span>
            <span className="shrink-0 text-accent-blue">{log.labels.pod ?? log.labels.container ?? ""}</span>
            <span className="truncate text-text-secondary">{log.message}</span>
          </div>
        );
      })}
    </div>
  );
}
