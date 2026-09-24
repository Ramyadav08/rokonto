import { Trace, TraceSpan } from "@/mock/traces";
import { formatDurationMs } from "@/lib/format";
import { cn } from "@/lib/cn";

function flatten(span: TraceSpan, depth: number, out: { span: TraceSpan; depth: number }[]) {
  out.push({ span, depth });
  for (const child of span.children) flatten(child, depth + 1, out);
}

export function TraceViewer({ trace }: { trace: Trace }) {
  const rows: { span: TraceSpan; depth: number }[] = [];
  flatten(trace.root, 0, rows);
  const total = trace.root.durationMs;

  return (
    <div className="text-xs">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-text-muted">
        <span>
          Trace <span className="font-mono text-text-secondary">{trace.traceId.slice(0, 16)}</span>
        </span>
        <span>{trace.spanCount} spans</span>
        <span>{formatDurationMs(trace.durationMs)}</span>
      </div>
      <div className="space-y-1">
        {rows.map(({ span, depth }) => {
          const left = (span.startOffsetMs / total) * 100;
          const width = Math.max(1, (span.durationMs / total) * 100);
          return (
            <div key={span.id} className="flex items-center gap-2">
              <div
                className="w-40 shrink-0 truncate text-text-secondary"
                style={{ paddingLeft: depth * 12 }}
                title={span.name}
              >
                {span.name}
              </div>
              <div className="relative h-4 flex-1 rounded bg-surface-raised">
                <div
                  className={cn(
                    "absolute top-0 h-4 rounded",
                    span.status === "Error" ? "bg-status-critical" : "bg-accent-blue"
                  )}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              </div>
              <div className="w-14 shrink-0 text-right tabular-nums text-text-muted">
                {formatDurationMs(span.durationMs)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
