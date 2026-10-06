"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, PlugZap } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { AlertStatus } from "@/components/alerts/AlertStatus";
import { AlertList } from "@/components/alerts/AlertList";
import { AlertDetails } from "@/components/alerts/AlertDetails";
import { useLiveAlerts } from "@/lib/datasource/useAlerts";
import type { DatasourceStatus } from "@/lib/datasource/types";
import type { AlertsQueryResult } from "@/lib/datasource/queryGateway";

export function AlertsPageContent() {
  const { dsStatus, live, loading, isLive } = useLiveAlerts();

  // A "connected" result with an empty alert list is a real (if quiet)
  // answer from Alertmanager -- render it as-is. Anything else (not
  // configured, still loading, or a genuine error) is surfaced explicitly
  // instead of silently swapping in mock alerts, which would defeat the
  // point of testing against the real cluster.
  const alerts = useMemo(() => (isLive ? live?.alerts ?? [] : []), [isLive, live]);
  const services = useMemo(() => Array.from(new Set(alerts.map((a) => a.service))), [alerts]);

  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("all");
  const [service, setService] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const [silenced, setSilenced] = useState<Set<string>>(new Set());

  const filtered = alerts.filter((a) => {
    if (severity !== "all" && a.severity !== severity) return false;
    if (status !== "all" && a.status !== status) return false;
    if (service !== "all" && a.service !== service) return false;
    return true;
  });

  const selected = alerts.find((a) => a.id === selectedId) ?? null;

  function toggle(set: Set<string>, setSet: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSet(next);
  }

  if (!isLive) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-2 p-6 text-center">
        <DatasourceBadge dsStatus={dsStatus} live={live} loading={loading} />
        {!dsStatus?.configured ? (
          <p className="flex items-center gap-1.5 text-sm text-text-muted">
            <PlugZap className="h-4 w-4" />
            Not signed in
          </p>
        ) : loading || live === null ? (
          <p className="flex items-center gap-1.5 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading alerts…
          </p>
        ) : (
          <>
            <p className="flex items-center gap-1.5 text-sm text-status-warning">
              <AlertTriangle className="h-4 w-4" />
              Datasource error
            </p>
            {live?.detail && <p className="max-w-md truncate text-xs text-text-muted">{live.detail}</p>}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 space-y-5 overflow-y-auto p-6">
        <AlertStatus alerts={alerts} />

        <div className="flex flex-wrap items-center gap-2">
          <DatasourceBadge dsStatus={dsStatus} live={live} loading={loading} />
          <Select
            options={["all", "Critical", "Warning", "Info"].map((s) => ({ label: s === "all" ? "All severities" : s, value: s }))}
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          />
          <Select
            options={["all", "Firing", "Pending", "Resolved"].map((s) => ({ label: s === "all" ? "All statuses" : s, value: s }))}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          />
          <Select
            options={[{ label: "All services", value: "all" }, ...services.map((s) => ({ label: s, value: s }))]}
            value={service}
            onChange={(e) => setService(e.target.value)}
          />
          <span className="ml-auto text-xs text-text-muted">{filtered.length} alerts</span>
        </div>

        <AlertList alerts={filtered} selectedId={selectedId} onSelect={(a) => setSelectedId(a.id)} />
      </div>

      {selected && (
        <AlertDetails
          alert={selected}
          acknowledged={acknowledged.has(selected.id)}
          silenced={silenced.has(selected.id)}
          onAcknowledge={() => toggle(acknowledged, setAcknowledged, selected.id)}
          onSilence={() => toggle(silenced, setSilenced, selected.id)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function DatasourceBadge({
  dsStatus,
  live,
  loading,
}: {
  dsStatus: DatasourceStatus | null;
  live: AlertsQueryResult | null;
  loading: boolean;
}) {
  if (!dsStatus?.configured) {
    return <span className="text-xs text-text-muted">Not signed in</span>;
  }
  if (loading && !live) {
    return <span className="text-xs text-text-muted">Connecting…</span>;
  }
  if (live?.status === "connected") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-status-healthy" title={`Datasource: ${dsStatus.host}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-status-healthy" />
        Live{dsStatus.host ? ` · ${dsStatus.host}` : ""}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-status-warning" title={live?.detail ?? "No data returned"}>
      <AlertTriangle className="h-3 w-3" />
      Datasource error
    </span>
  );
}
