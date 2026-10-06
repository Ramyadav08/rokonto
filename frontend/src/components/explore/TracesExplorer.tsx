"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, GripVertical, X } from "lucide-react";
import { mockData } from "@/lib/mockData";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatClock, formatDurationMs } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useResizableWidth } from "@/lib/useResizableWidth";
import { TraceViewer } from "./TraceViewer";
import { TIME_RANGE_PRESETS } from "@/dashboard/types";

export function TracesExplorer() {
  const { width: panelWidth, onMouseDown: onResizeStart } = useResizableWidth(460, {
    min: 340,
    max: 900,
    storageKey: "observex.tracePanelWidth",
  });
  const [timeRange, setTimeRange] = useState("now-15m");
  const [service, setService] = useState("all");
  const [operation, setOperation] = useState("all");
  const [status, setStatus] = useState("all");
  const [traceIdSearch, setTraceIdSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const traces = useMemo(() => mockData.getTraces(), []);
  const filtered = useMemo(
    () =>
      traces.filter((t) => {
        if (service !== "all" && t.service !== service) return false;
        if (operation !== "all" && t.operation !== operation) return false;
        if (status !== "all" && t.status !== status) return false;
        if (traceIdSearch && !t.traceId.startsWith(traceIdSearch.trim())) return false;
        return true;
      }),
    [traces, service, operation, status, traceIdSearch]
  );

  const selected = filtered.find((t) => t.traceId === selectedId) ?? null;

  return (
    <div className="flex h-full min-h-0">
      <div className={cn("flex min-w-0 flex-1 flex-col", selected && "hidden lg:flex")}>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <Select options={TIME_RANGE_PRESETS} value={timeRange} onChange={(e) => setTimeRange(e.target.value)} />
          <Select
            options={[{ label: "All services", value: "all" }, ...mockData.traceServices.map((s) => ({ label: s, value: s }))]}
            value={service}
            onChange={(e) => setService(e.target.value)}
          />
          <Select
            options={[{ label: "All operations", value: "all" }, ...mockData.traceOperations.map((o) => ({ label: o, value: o }))]}
            value={operation}
            onChange={(e) => setOperation(e.target.value)}
          />
          <Select
            options={["all", "OK", "Error"].map((s) => ({ label: s === "all" ? "All statuses" : s, value: s }))}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          />
          <input
            className="min-w-[160px] rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent-blue"
            placeholder="Trace ID"
            value={traceIdSearch}
            onChange={(e) => setTraceIdSearch(e.target.value)}
          />
          <span className="ml-auto text-xs text-text-muted">{filtered.length} traces</span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[640px] border-collapse text-xs">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-left text-text-muted">
                <th className="px-4 py-2 font-medium">Trace ID</th>
                <th className="px-4 py-2 font-medium">Service</th>
                <th className="px-4 py-2 font-medium">Operation</th>
                <th className="px-4 py-2 font-medium text-right">Duration</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.traceId}
                  onClick={() => setSelectedId(t.traceId)}
                  className={cn(
                    "cursor-pointer border-b border-border/60 hover:bg-surface-hover",
                    selectedId === t.traceId && "bg-surface-hover"
                  )}
                >
                  <td className="px-4 py-2 font-mono text-accent-blue">{t.traceId.slice(0, 12)}…</td>
                  <td className="px-4 py-2 text-text-primary">{t.service}</td>
                  <td className="px-4 py-2 text-text-secondary">{t.operation}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-text-secondary">
                    {formatDurationMs(t.durationMs)}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-text-muted">
                    {formatClock(t.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-6 text-center text-sm text-text-muted">No traces match the current filters.</div>
          )}
        </div>
      </div>

      {selected && (
        <div
          onMouseDown={onResizeStart}
          className="group relative hidden w-1.5 shrink-0 cursor-col-resize items-center justify-center lg:flex"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize trace panel"
        >
          <div className="h-full w-px bg-border group-hover:bg-accent-blue" />
          <GripVertical className="absolute h-4 w-3 text-text-muted opacity-0 group-hover:opacity-100" />
        </div>
      )}

      {selected && (
        <div
          className="w-full shrink-0 overflow-y-auto bg-surface p-4 lg:w-[var(--panel-w)]"
          style={{ ["--panel-w" as string]: `${panelWidth}px` }}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              onClick={() => setSelectedId(null)}
              className="flex shrink-0 items-center gap-1 text-text-muted hover:text-text-primary lg:hidden"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <h3 className="truncate text-sm font-medium text-text-primary">{selected.operation}</h3>
            <button
              onClick={() => setSelectedId(null)}
              className="hidden shrink-0 text-text-muted hover:text-text-primary lg:block"
              aria-label="Close trace"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <TraceViewer trace={selected} />
        </div>
      )}
    </div>
  );
}
