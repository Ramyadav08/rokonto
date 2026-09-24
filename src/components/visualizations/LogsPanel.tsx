"use client";

import { ObservexPanel } from "@/dashboard/types";
import { getLogs } from "@/mock/logs";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/cn";

const LEVEL_COLOR: Record<string, string> = {
  ERROR: "text-status-critical",
  WARN: "text-status-warning",
  INFO: "text-status-info",
  DEBUG: "text-text-muted",
};

export function LogsPanel({ panel }: { panel: ObservexPanel }) {
  const logs = getLogs().slice(0, 40);

  return (
    <div className="h-full overflow-y-auto font-mono text-xs" data-panel-id={panel.id}>
      {logs.map((log) => (
        <div key={log.id} className="flex gap-2 border-b border-border/40 px-1 py-1">
          <span className="shrink-0 text-text-muted">{formatClock(log.timestamp)}</span>
          <span className={cn("w-10 shrink-0 font-medium", LEVEL_COLOR[log.level])}>{log.level}</span>
          <span className="shrink-0 text-accent-blue">{log.service}</span>
          <span className="truncate text-text-secondary">{log.message}</span>
        </div>
      ))}
    </div>
  );
}
