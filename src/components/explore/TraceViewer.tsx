"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { Trace, TraceSpan } from "@/mock/traces";
import { formatDurationMs } from "@/lib/format";
import { cn } from "@/lib/cn";

const SERVICE_COLORS = ["#3b82f6", "#8b5cf6", "#22c55e", "#eab308", "#06b6d4", "#f97316", "#ec4899", "#84cc16"];
const LABEL_COL = "minmax(84px,1fr)";
const BAR_COL = "minmax(140px,2fr)";

function buildServiceColors(root: TraceSpan): Map<string, string> {
  const colors = new Map<string, string>();
  function visit(span: TraceSpan) {
    if (!colors.has(span.service)) colors.set(span.service, SERVICE_COLORS[colors.size % SERVICE_COLORS.length]);
    span.children.forEach(visit);
  }
  visit(root);
  return colors;
}

interface FlatRow {
  span: TraceSpan;
  depth: number;
  hasChildren: boolean;
}

function flattenVisible(span: TraceSpan, depth: number, collapsed: Set<string>, out: FlatRow[]) {
  out.push({ span, depth, hasChildren: span.children.length > 0 });
  if (collapsed.has(span.id)) return;
  for (const child of span.children) flattenVisible(child, depth + 1, collapsed, out);
}

const TICK_COUNT = 4;

export function TraceViewer({ trace }: { trace: Trace }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);

  const serviceColors = useMemo(() => buildServiceColors(trace.root), [trace]);
  const rows = useMemo(() => {
    const out: FlatRow[] = [];
    flattenVisible(trace.root, 0, collapsed, out);
    return out;
  }, [trace, collapsed]);

  const total = trace.root.durationMs;
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => (total / TICK_COUNT) * i);
  const selectedSpan = rows.find((r) => r.span.id === selectedSpanId)?.span;

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="text-xs">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-text-muted">
        <span>
          Trace <span className="font-mono text-text-secondary">{trace.traceId.slice(0, 16)}</span>
        </span>
        <span>{trace.spanCount} spans</span>
        <span>{formatDurationMs(trace.durationMs)}</span>
        <span className="flex flex-wrap items-center gap-2">
          {Array.from(serviceColors.entries()).map(([svc, color]) => (
            <span key={svc} className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
              {svc}
            </span>
          ))}
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[360px]">
          <div
            className="mb-1 grid items-end gap-2 border-b border-border pb-1 text-[10px] text-text-muted"
            style={{ gridTemplateColumns: `${LABEL_COL} ${BAR_COL} 56px` }}
          >
            <div />
            <div className="relative h-4">
              {ticks.map((t, i) => {
                const isFirst = i === 0;
                const isLast = i === ticks.length - 1;
                return (
                  <span
                    key={i}
                    className={cn("absolute", isFirst && "left-0", isLast && "right-0", !isFirst && !isLast && "-translate-x-1/2")}
                    style={!isFirst && !isLast ? { left: `${(t / total) * 100}%` } : undefined}
                  >
                    {formatDurationMs(t)}
                  </span>
                );
              })}
            </div>
            <div />
          </div>

          <div className="space-y-0.5">
            {rows.map(({ span, depth, hasChildren }) => {
              const left = (span.startOffsetMs / total) * 100;
              const width = Math.max(0.8, (span.durationMs / total) * 100);
              const color = span.status === "Error" ? "#ef4444" : serviceColors.get(span.service) ?? "#3b82f6";
              return (
                <button
                  key={span.id}
                  onClick={() => setSelectedSpanId(span.id)}
                  className={cn(
                    "grid w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-surface-hover",
                    selectedSpanId === span.id && "bg-surface-hover"
                  )}
                  style={{ gridTemplateColumns: `${LABEL_COL} ${BAR_COL} 56px` }}
                >
                  <div className="flex min-w-0 items-center gap-1" style={{ paddingLeft: depth * 10 }}>
                    {hasChildren ? (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCollapse(span.id);
                        }}
                        className="shrink-0 text-text-muted hover:text-text-primary"
                      >
                        {collapsed.has(span.id) ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </span>
                    ) : (
                      <span className="w-3 shrink-0" />
                    )}
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
                    <span className="truncate text-text-secondary" title={span.name}>
                      {span.name}
                    </span>
                  </div>
                  <div className="relative h-4 rounded bg-surface-raised">
                    <div
                      className="absolute top-0 h-4 rounded"
                      style={{ left: `${left}%`, width: `${width}%`, background: color }}
                    />
                  </div>
                  <div className="text-right tabular-nums text-text-muted">{formatDurationMs(span.durationMs)}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {selectedSpan && (
        <div className="mt-3 rounded-md border border-border bg-surface-raised p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium text-text-primary">{selectedSpan.name}</span>
            <button onClick={() => setSelectedSpanId(null)} className="text-text-muted hover:text-text-primary" aria-label="Close span details">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <SpanDetail label="Service" value={selectedSpan.service} />
            <SpanDetail
              label="Status"
              value={selectedSpan.status}
              valueClass={selectedSpan.status === "Error" ? "text-status-critical" : "text-status-healthy"}
            />
            <SpanDetail label="Duration" value={formatDurationMs(selectedSpan.durationMs)} />
            <SpanDetail label="Start offset" value={formatDurationMs(selectedSpan.startOffsetMs)} />
            <SpanDetail label="Span ID" value={selectedSpan.id} mono />
          </div>
        </div>
      )}
    </div>
  );
}

function SpanDetail({ label, value, mono, valueClass }: { label: string; value: string; mono?: boolean; valueClass?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-text-muted">{label}</div>
      <div className={cn("truncate text-text-primary", mono && "font-mono", valueClass)}>{value}</div>
    </div>
  );
}
