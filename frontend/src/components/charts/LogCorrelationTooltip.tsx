import { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { formatClock } from "@/lib/format";

/**
 * Drop-in replacement for recharts' default Tooltip `content`: shows the
 * usual time + value line, plus a link into Explore > Logs scoped to this
 * instant. This used to also preview a "correlated" log line inline, but
 * that line was synthesized on every hover (a real Loki query per mouse
 * move across the chart isn't practical, and faking one isn't honest) --
 * the real logs around this instant are one click away instead, where
 * LogsExplorer fetches them for real.
 */
export function LogCorrelationTooltip({
  timestamp,
  valueLine,
}: {
  timestamp: number;
  valueLine: ReactNode;
}) {
  return (
    <div className="w-64 rounded-md border border-border bg-surface-raised px-2.5 py-2 text-xs shadow-lg">
      <div className="mb-1 text-text-muted">{formatClock(timestamp)}</div>
      <div className="text-text-primary">{valueLine}</div>
      <div className="mt-1.5 flex items-center gap-1 border-t border-border pt-1.5 text-accent-blue">
        View logs at this time <ArrowRight className="h-3 w-3" />
      </div>
    </div>
  );
}
