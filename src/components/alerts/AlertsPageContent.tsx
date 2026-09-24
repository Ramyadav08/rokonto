"use client";

import { useMemo, useState } from "react";
import { getAlerts } from "@/mock/alerts";
import { Select } from "@/components/ui/Select";
import { AlertStatus } from "@/components/alerts/AlertStatus";
import { AlertList } from "@/components/alerts/AlertList";
import { AlertDetails } from "@/components/alerts/AlertDetails";

export function AlertsPageContent() {
  const alerts = useMemo(() => getAlerts(), []);
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

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 space-y-5 overflow-y-auto p-6">
        <AlertStatus alerts={alerts} />

        <div className="flex flex-wrap items-center gap-2">
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
