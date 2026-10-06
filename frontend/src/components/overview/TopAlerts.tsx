"use client";

import Link from "next/link";
import { AlertTriangle, OctagonAlert } from "lucide-react";
import { useLiveAlerts } from "@/lib/datasource/useAlerts";
import type { AlertItem, AlertSeverity, AlertStatusValue } from "@/lib/datasource/queryGateway";
import { ExpandableCard } from "@/components/ui/ExpandableCard";
import { StatusBadge } from "@/components/ui/StatusBadge";

const TOP_N = 15;

const STATUS_RANK: Record<AlertStatusValue, number> = { Firing: 0, Pending: 1, Resolved: 2 };
const SEVERITY_RANK: Record<AlertSeverity, number> = { Critical: 0, Warning: 1, Info: 2 };

/** Firing beats pending beats resolved; within the same status, critical
    beats warning beats info; ties broken by most recent first. Same real
    alert list RecentProblems uses, just ranked and capped differently. */
function rankAlerts(alerts: AlertItem[]): AlertItem[] {
  return [...alerts].sort((a, b) => {
    const statusDiff = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (statusDiff !== 0) return statusDiff;
    const sevDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return b.startedAt - a.startedAt;
  });
}

export function TopAlerts() {
  const { dsStatus, live, loading, isLive } = useLiveAlerts();

  if (!isLive) {
    return (
      <ExpandableCard title="Top Alerts" bodyClassName="!p-0">
        <div className="px-4 py-6 text-center text-xs text-text-muted">
          {!dsStatus?.configured
            ? "Not signed in."
            : loading || live === null
              ? "Loading…"
              : `Datasource error${live?.detail ? `: ${live.detail}` : "."}`}
        </div>
      </ExpandableCard>
    );
  }

  const alerts = rankAlerts(live?.alerts ?? []).slice(0, TOP_N);

  return (
    <ExpandableCard title="Top Alerts" bodyClassName="!p-0 divide-y divide-border">
      {alerts.map((a) => {
        const Icon = a.severity === "Critical" ? OctagonAlert : AlertTriangle;
        return (
          <Link
            key={a.id}
            href={`/explore/logs?service=${encodeURIComponent(a.service)}`}
            className="flex items-start gap-3 px-4 py-2.5 hover:bg-surface-hover"
          >
            <Icon
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                a.severity === "Critical" ? "text-status-critical" : "text-status-warning"
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm text-text-primary">
                <span className="truncate">{a.name}</span>
                <span className="text-text-muted">· {a.service}</span>
              </div>
              <div className="mt-0.5 truncate text-xs text-text-muted" title={a.description}>
                {a.description}
              </div>
            </div>
            <StatusBadge status={a.status} className="shrink-0" />
          </Link>
        );
      })}
      {alerts.length === 0 && (
        <div className="px-4 py-6 text-center text-xs text-text-muted">No alerts right now.</div>
      )}
    </ExpandableCard>
  );
}
