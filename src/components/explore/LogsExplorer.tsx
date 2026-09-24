"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { mockData } from "@/lib/mockData";
import { LogEntry } from "@/mock/logs";
import { Select } from "@/components/ui/Select";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/cn";
import { TIME_RANGE_PRESETS } from "@/dashboard/types";

const LEVEL_COLOR: Record<string, string> = {
  ERROR: "text-status-critical",
  WARN: "text-status-warning",
  INFO: "text-status-info",
  DEBUG: "text-text-muted",
};

export function LogsExplorer() {
  const searchParams = useSearchParams();
  const [timeRange, setTimeRange] = useState("now-15m");
  const [service, setService] = useState(searchParams.get("service") ?? "all");
  const [namespace, setNamespace] = useState("all");
  const [level, setLevel] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<LogEntry | null>(null);

  const allLogs = useMemo(() => mockData.getLogs(), []);
  const logs = useMemo(
    () => mockData.filterLogs(allLogs, { service, namespace, level, search }),
    [allLogs, service, namespace, level, search]
  );

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <Select options={TIME_RANGE_PRESETS} value={timeRange} onChange={(e) => setTimeRange(e.target.value)} />
          <Select
            options={[{ label: "All services", value: "all" }, ...mockData.logServices.map((s) => ({ label: s, value: s }))]}
            value={service}
            onChange={(e) => setService(e.target.value)}
          />
          <Select
            options={[{ label: "All namespaces", value: "all" }, ...mockData.logNamespaces.map((n) => ({ label: n, value: n }))]}
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
          />
          <Select
            options={["all", "ERROR", "WARN", "INFO", "DEBUG"].map((l) => ({
              label: l === "all" ? "All levels" : l,
              value: l,
            }))}
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          />
          <input
            className="min-w-[200px] flex-1 rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent-blue"
            placeholder="Search logs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="ml-auto text-xs text-text-muted">{logs.length} results</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto font-mono text-xs">
          {logs.slice(0, 300).map((log) => (
            <button
              key={log.id}
              onClick={() => setSelected(log)}
              className={cn(
                "flex w-full items-start gap-2 border-b border-border/40 px-4 py-1.5 text-left hover:bg-surface-hover",
                selected?.id === log.id && "bg-surface-hover"
              )}
            >
              <span className="shrink-0 text-text-muted">{formatClock(log.timestamp)}</span>
              <span className={cn("w-12 shrink-0 font-medium", LEVEL_COLOR[log.level])}>{log.level}</span>
              <span className="w-32 shrink-0 truncate text-accent-blue">{log.service}</span>
              <span className="truncate text-text-secondary">{log.message}</span>
            </button>
          ))}
          {logs.length === 0 && (
            <div className="p-6 text-center text-sm text-text-muted">No logs match the current filters.</div>
          )}
        </div>
      </div>

      {selected && (
        <div className="w-80 shrink-0 overflow-y-auto border-l border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-medium text-text-primary">Log details</h3>
            <button onClick={() => setSelected(null)} className="text-text-muted hover:text-text-primary">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-3 px-4 py-4 text-xs">
            <Detail label="Timestamp" value={new Date(selected.timestamp).toISOString()} />
            <Detail label="Level" value={selected.level} valueClass={LEVEL_COLOR[selected.level]} />
            <Detail label="Service" value={selected.service} />
            <Detail label="Namespace" value={selected.namespace} />
            <Detail label="Pod" value={selected.pod} />
            <Detail label="Container" value={selected.container} />
            <Detail label="Message" value={selected.message} mono />
            <Detail label="Trace ID" value={selected.traceId} mono />
            <Detail label="Span ID" value={selected.spanId} mono />
            <div>
              <div className="mb-1 text-text-muted">Labels</div>
              <div className="space-y-1">
                {Object.entries(selected.labels).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2 rounded bg-surface-raised px-2 py-1">
                    <span className="text-text-muted">{k}</span>
                    <span className="truncate text-text-secondary">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, mono, valueClass }: { label: string; value: string; mono?: boolean; valueClass?: string }) {
  return (
    <div>
      <div className="mb-0.5 text-text-muted">{label}</div>
      <div className={cn("break-all text-text-primary", mono && "font-mono", valueClass)}>{value}</div>
    </div>
  );
}
