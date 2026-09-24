import { ArrowDown, ArrowUp } from "lucide-react";
import { getTopMovers } from "@/mock/overview";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ExpandableCard } from "@/components/ui/ExpandableCard";
import { cn } from "@/lib/cn";

export function TopMovers() {
  const rows = getTopMovers();

  return (
    <ExpandableCard title="Top Services by Resource Change" bodyClassName="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-xs">
        <thead>
          <tr className="border-b border-border text-left text-text-muted">
            <th className="py-1.5 font-medium">Service</th>
            <th className="py-1.5 font-medium">Status</th>
            <th className="py-1.5 text-right font-medium">Previous CPU</th>
            <th className="py-1.5 text-right font-medium">Current CPU</th>
            <th className="py-1.5 text-right font-medium">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const up = r.changePercent >= 0;
            return (
              <tr key={r.service} className="border-b border-border/60 last:border-0 hover:bg-surface-hover">
                <td className="py-1.5">
                  <div className="font-medium text-text-primary">{r.service}</div>
                  <div className="text-text-muted">{r.namespace}</div>
                </td>
                <td className="py-1.5">
                  <StatusBadge status={r.status} />
                </td>
                <td className="py-1.5 text-right tabular-nums text-text-secondary">{r.previous}%</td>
                <td className="py-1.5 text-right tabular-nums text-text-secondary">{r.current}%</td>
                <td className="py-1.5 text-right">
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium tabular-nums",
                      up ? "bg-status-critical/15 text-status-critical" : "bg-status-healthy/15 text-status-healthy"
                    )}
                  >
                    {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    {Math.abs(r.changePercent)}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ExpandableCard>
  );
}
