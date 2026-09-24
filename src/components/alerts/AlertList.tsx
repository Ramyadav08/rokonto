"use client";

import { AlertItem, formatDuration } from "@/mock/alerts";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export function AlertList({
  alerts,
  selectedId,
  onSelect,
}: {
  alerts: AlertItem[];
  selectedId: string | null;
  onSelect: (alert: AlertItem) => void;
}) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-xs">
        <thead>
          <tr className="border-b border-border text-left text-text-muted">
            <th className="px-3 py-2 font-medium">Alert</th>
            <th className="px-3 py-2 font-medium">Severity</th>
            <th className="px-3 py-2 font-medium">Service</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Started</th>
            <th className="px-3 py-2 font-medium">Duration</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((a) => (
            <tr
              key={a.id}
              onClick={() => onSelect(a)}
              className={cn(
                "cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-hover",
                selectedId === a.id && "bg-surface-hover"
              )}
            >
              <td className="px-3 py-2 font-medium text-text-primary">{a.name}</td>
              <td className="px-3 py-2">
                <StatusBadge status={a.severity} />
              </td>
              <td className="px-3 py-2 text-text-secondary">{a.service}</td>
              <td className="px-3 py-2">
                <StatusBadge status={a.status} />
              </td>
              <td className="px-3 py-2 text-text-secondary">
                {formatDuration(a.startedAt)} ago
              </td>
              <td className="px-3 py-2 text-text-secondary">
                {formatDuration(a.startedAt, a.resolvedAt ?? Date.now())}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {alerts.length === 0 && (
        <div className="p-6 text-center text-sm text-text-muted">No alerts match the current filters.</div>
      )}
    </Card>
  );
}
