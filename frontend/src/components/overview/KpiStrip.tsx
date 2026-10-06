"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { useLiveAlerts } from "@/lib/datasource/useAlerts";
import type { DatasourceQueryResult, DatasourceStatus } from "@/lib/datasource/types";
import { useSelectedCluster, withClusterParam } from "@/lib/clusterContext";

const TONE_TEXT: Record<string, string> = {
  healthy: "text-status-healthy",
  warning: "text-status-warning",
  critical: "text-status-critical",
  neutral: "text-text-secondary",
};

const TREND_ICON = { up: ArrowUp, down: ArrowDown, flat: Minus };

interface KpiTile {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "flat";
  tone: "healthy" | "warning" | "critical" | "neutral";
}

// Base shape for every tile -- real values get merged in below for the ones
// with a real datasource; the rest (CPU/Memory/Error Rate/Deployments) have
// no backend mapping yet (see the comment on `unavailable` below) and stay
// at this placeholder "—" rather than a fabricated number.
const TILE_LABELS: KpiTile[] = [
  { label: "Nodes Healthy", value: "—", delta: "", trend: "flat", tone: "neutral" },
  { label: "Pods Running", value: "—", delta: "", trend: "flat", tone: "neutral" },
  { label: "CPU Usage", value: "—", delta: "", trend: "flat", tone: "neutral" },
  { label: "Memory Usage", value: "—", delta: "", trend: "flat", tone: "neutral" },
  { label: "Error Rate", value: "—", delta: "", trend: "flat", tone: "neutral" },
  { label: "Active Alerts", value: "—", delta: "", trend: "flat", tone: "neutral" },
  { label: "Deployments", value: "—", delta: "", trend: "flat", tone: "neutral" },
];

async function fetchInstant(query: string, selectedCluster: string | null): Promise<number | null> {
  try {
    const res = await fetch(withClusterParam(`/api/datasource/metrics?query=${encodeURIComponent(query)}&range=now-5m`, selectedCluster));
    const result: DatasourceQueryResult = await res.json();
    if (result.status !== "connected") return null;
    const points = result.series?.[0]?.points ?? [];
    if (points.length === 0) return null;
    return points[points.length - 1].value;
  } catch {
    return null;
  }
}

// Nodes/pods counts and Active Alerts have a clean, unambiguous real-data
// mapping (kube-state-metrics counts, real Alertmanager alerts) so they're
// wired to live data here. CPU/Memory/Error Rate/Deployments tiles show
// "not available" -- see the fallback case in `merged` below for why.
export function KpiStrip() {
  const tiles = TILE_LABELS;
  const { live: liveAlerts, isLive: alertsLive } = useLiveAlerts();
  const { selectedCluster } = useSelectedCluster();

  const [dsStatus, setDsStatus] = useState<DatasourceStatus | null>(null);
  const [nodeStats, setNodeStats] = useState<{ ready: number; total: number } | null>(null);
  const [podsRunning, setPodsRunning] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/datasource/metrics/status")
      .then((r) => r.json())
      .then(setDsStatus)
      .catch(() => setDsStatus({ configured: false }));
  }, []);

  useEffect(() => {
    if (!dsStatus?.configured) {
      setNodeStats(null);
      setPodsRunning(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      fetchInstant("count(kube_node_info)", selectedCluster),
      fetchInstant('count(kube_node_status_condition{condition="Ready",status="true"})', selectedCluster),
      fetchInstant('sum(kube_pod_status_phase{phase="Running"})', selectedCluster),
    ]).then(([total, ready, running]) => {
      if (cancelled) return;
      setNodeStats(total !== null && ready !== null ? { ready, total } : null);
      setPodsRunning(running);
    });
    return () => {
      cancelled = true;
    };
  }, [dsStatus, selectedCluster]);

  // These three tiles have a real datasource wired up, so they never fall
  // back to the mock value below -- an unavailable real value shows as "—",
  // not as a fabricated number that would defeat the point of testing
  // against the real cluster. The remaining tiles (CPU/Memory/Error
  // Rate/Deployments) have no real mapping at all yet and stay on mock.
  const unavailable = (tile: KpiTile): KpiTile => ({
    ...tile,
    value: "—",
    delta: !dsStatus?.configured ? "not configured" : "unavailable",
    trend: "flat",
    tone: "neutral",
  });

  const merged: KpiTile[] = tiles.map((tile) => {
    if (tile.label === "Nodes Healthy") {
      if (!nodeStats) return unavailable(tile);
      return {
        ...tile,
        value: `${nodeStats.ready}/${nodeStats.total}`,
        delta: "live",
        trend: "flat",
        tone: nodeStats.ready === nodeStats.total ? "healthy" : "warning",
      };
    }
    if (tile.label === "Pods Running") {
      if (podsRunning === null) return unavailable(tile);
      return { ...tile, value: String(Math.round(podsRunning)), delta: "live", trend: "flat" };
    }
    if (tile.label === "Active Alerts") {
      if (!alertsLive) return unavailable(tile);
      const alerts = liveAlerts?.alerts ?? [];
      const firing = alerts.filter((a) => a.status === "Firing").length;
      const pending = alerts.filter((a) => a.status === "Pending").length;
      return {
        ...tile,
        value: `${firing} firing`,
        delta: `${pending} pending`,
        trend: "flat",
        tone: firing > 0 ? "critical" : pending > 0 ? "warning" : "healthy",
      };
    }
    // CPU Usage / Memory Usage / Error Rate / Deployments: no backend
    // mapping exists for these (cluster-wide utilization normalization and
    // "degraded deployment" classification both need judgment calls a
    // single query can't make honestly), so there's nothing to fetch --
    // shown as "not available" rather than silently blank.
    return { ...tile, value: "—", delta: "not available" };
  });

  return (
    <Card className="grid grid-cols-2 divide-y divide-border sm:grid-cols-4 sm:divide-y-0 sm:divide-x lg:grid-cols-7">
      {merged.map((tile) => {
        const TrendIcon = TREND_ICON[tile.trend];
        return (
          <div key={tile.label} className="p-3.5">
            <div className="text-xs text-text-muted">{tile.label}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-text-primary">{tile.value}</div>
            <div className={cn("mt-1 flex items-center gap-1 text-xs", TONE_TEXT[tile.tone])}>
              <TrendIcon className="h-3 w-3" />
              {tile.delta}
            </div>
          </div>
        );
      })}
    </Card>
  );
}
