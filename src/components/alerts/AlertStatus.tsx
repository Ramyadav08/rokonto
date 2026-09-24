import { AlertItem } from "@/mock/alerts";
import { Card } from "@/components/ui/Card";

const CARDS: { label: string; status: AlertItem["status"]; dot: string }[] = [
  { label: "Firing", status: "Firing", dot: "bg-status-critical" },
  { label: "Pending", status: "Pending", dot: "bg-status-warning" },
  { label: "Resolved", status: "Resolved", dot: "bg-status-healthy" },
];

export function AlertStatus({ alerts }: { alerts: AlertItem[] }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {CARDS.map((c) => {
        const count = alerts.filter((a) => a.status === c.status).length;
        return (
          <Card key={c.status} className="p-4">
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
              {c.label}
            </div>
            <div className="mt-1 text-2xl font-semibold text-text-primary tabular-nums">{count}</div>
          </Card>
        );
      })}
    </div>
  );
}
