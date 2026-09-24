"use client";

import Link from "next/link";
import { BellOff, CheckCheck, LineChart, ScrollText, X } from "lucide-react";
import { AlertItem, formatDuration } from "@/mock/alerts";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";

interface AlertDetailsProps {
  alert: AlertItem;
  acknowledged: boolean;
  silenced: boolean;
  onAcknowledge: () => void;
  onSilence: () => void;
  onClose: () => void;
}

export function AlertDetails({
  alert,
  acknowledged,
  silenced,
  onAcknowledge,
  onSilence,
  onClose,
}: AlertDetailsProps) {
  return (
    <div className="w-96 shrink-0 overflow-y-auto border-l border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-medium text-text-primary">{alert.name}</h3>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 px-4 py-4 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={alert.severity} />
          <StatusBadge status={alert.status} />
          {acknowledged && <StatusBadge status="info" className="bg-accent-blue/15 text-accent-blue border-accent-blue/30" />}
        </div>

        <Detail label="Service" value={alert.service} />
        <Detail label="Description" value={alert.description} />
        <Detail label="Started" value={`${new Date(alert.startedAt).toLocaleString()} (${formatDuration(alert.startedAt)} ago)`} />

        <div>
          <div className="mb-1 text-text-muted">Labels</div>
          <div className="space-y-1">
            {Object.entries(alert.labels).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2 rounded bg-surface-raised px-2 py-1">
                <span className="text-text-muted">{k}</span>
                <span className="truncate text-text-secondary">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 text-text-muted">Annotations</div>
          <div className="space-y-1">
            {Object.entries(alert.annotations).map(([k, v]) => (
              <div key={k} className="rounded bg-surface-raised px-2 py-1">
                <div className="text-text-muted">{k}</div>
                <div className="truncate text-text-secondary">{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant={acknowledged ? "primary" : "secondary"} onClick={onAcknowledge}>
            <CheckCheck className="h-3.5 w-3.5" />
            {acknowledged ? "Acknowledged" : "Acknowledge"}
          </Button>
          <Button variant={silenced ? "primary" : "secondary"} onClick={onSilence}>
            <BellOff className="h-3.5 w-3.5" />
            {silenced ? "Silenced" : "Silence"}
          </Button>
          <Link href={`/explore/metrics`}>
            <Button variant="secondary">
              <LineChart className="h-3.5 w-3.5" />
              View Metrics
            </Button>
          </Link>
          <Link href={`/explore/logs?service=${encodeURIComponent(alert.service)}`}>
            <Button variant="secondary">
              <ScrollText className="h-3.5 w-3.5" />
              View Logs
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-0.5 text-text-muted">{label}</div>
      <div className="text-text-primary">{value}</div>
    </div>
  );
}
