"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { HelpCircle, Sparkles, X } from "lucide-react";
import { mockData } from "@/lib/mockData";
import { LogEntry } from "@/mock/logs";
import { filterLogsByQuery } from "@/lib/logQuery";
import { Select } from "@/components/ui/Select";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/cn";
import { TIME_RANGE_PRESETS } from "@/dashboard/types";

const QUERY_HELP = [
  'service="api-gateway"   exact match on a field',
  "level!=INFO             negated match",
  "timeout                 word anywhere in the message",
  '"connection refused"    exact phrase',
  "",
  "Fields: service, namespace, level, pod, container",
  "Combine terms with a space -- they all must match (AND).",
].join("\n");

const LEVEL_COLOR: Record<string, string> = {
  ERROR: "text-status-critical",
  WARN: "text-status-warning",
  INFO: "text-status-info",
  DEBUG: "text-text-muted",
};

export function LogsExplorer() {
  const searchParams = useSearchParams();
  const around = searchParams.get("around");
  const hint = searchParams.get("q") ?? undefined;

  const [timeRange, setTimeRange] = useState("now-15m");
  const [service, setService] = useState(searchParams.get("service") ?? "all");
  const [namespace, setNamespace] = useState("all");
  const [level, setLevel] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<LogEntry | null>(null);

  // Arriving from a "view logs at this point" click on a chart: base the
  // list on a burst of logs synthesized around that instant instead of the
  // general pool, which may not even cover that time window.
  const baseLogs = useMemo(
    () => (around ? mockData.generateLogsAround(Number(around), hint, 40) : mockData.getLogs()),
    [around, hint]
  );
  const logs = useMemo(() => {
    const byDropdowns = mockData.filterLogs(baseLogs, { service, namespace, level });
    return filterLogsByQuery(byDropdowns, query);
  }, [baseLogs, service, namespace, level, query]);

  useEffect(() => {
    if (around) setSelected(baseLogs[0] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [around]);

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        {around && (
          <div className="flex items-center gap-2 border-b border-border bg-accent-blue/10 px-4 py-2 text-xs text-accent-blue">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span>
              Showing logs around {formatClock(Number(around))}
              {hint ? ` correlated with "${hint}"` : ""}
            </span>
            <Link href="/explore/logs" className="ml-auto flex items-center gap-1 text-text-secondary hover:text-text-primary">
              <X className="h-3.5 w-3.5" />
              Clear
            </Link>
          </div>
        )}

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
          <div className="relative min-w-[240px] flex-1">
            <input
              className="w-full rounded-md border border-border bg-surface-raised py-1.5 pl-2.5 pr-7 font-mono text-xs text-text-primary outline-none focus:border-accent-blue"
              placeholder='service="api-gateway" level=ERROR timeout'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              spellCheck={false}
            />
            <span
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-help text-text-muted"
              title={QUERY_HELP}
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </span>
          </div>
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
