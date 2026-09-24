import { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { formatClock } from "@/lib/format";
import { getCorrelatedLog } from "@/lib/logCorrelation";
import { cn } from "@/lib/cn";

const LEVEL_COLOR: Record<string, string> = {
  ERROR: "text-status-critical",
  WARN: "text-status-warning",
  INFO: "text-status-info",
  DEBUG: "text-text-muted",
};

/**
 * Drop-in replacement for recharts' default Tooltip `content`: shows the
 * usual time + value line, plus the closest correlated mock log entry so
 * hovering a spike hints at "why", not just "what".
 */
export function LogCorrelationTooltip({
  timestamp,
  hint,
  valueLine,
}: {
  timestamp: number;
  hint?: string;
  valueLine: ReactNode;
}) {
  const log = getCorrelatedLog(timestamp, hint);

  return (
    <div className="w-64 rounded-md border border-border bg-surface-raised px-2.5 py-2 text-xs shadow-lg">
      <div className="mb-1 text-text-muted">{formatClock(timestamp)}</div>
      <div className="mb-1.5 text-text-primary">{valueLine}</div>
      {log && (
        <div className="border-t border-border pt-1.5">
          <div className={cn("font-medium", LEVEL_COLOR[log.level])}>
            {log.level} · {log.service}
          </div>
          <div className="truncate text-text-secondary">{log.message}</div>
          <div className="mt-1 flex items-center gap-1 text-accent-blue">
            View logs at this time <ArrowRight className="h-3 w-3" />
          </div>
        </div>
      )}
    </div>
  );
}
