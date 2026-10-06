"use client";

import { useEffect, useState } from "react";
import type { DatasourceStatus } from "./types";
import type { AlertsQueryResult } from "./queryGateway";
import { useSelectedCluster, withClusterParam } from "@/lib/clusterContext";

export interface LiveAlerts {
  dsStatus: DatasourceStatus | null;
  live: AlertsQueryResult | null;
  loading: boolean;
  isLive: boolean;
}

/** Fetches Alertmanager status once, then the real alert list -- the same
    status-then-data, cancelled-flag-guarded pattern used for the Prometheus
    datasource in MetricsExplorer, shared here so the Alerts page and
    Overview's Recent Problems can never disagree about what's "live". */
export function useLiveAlerts(): LiveAlerts {
  const { selectedCluster } = useSelectedCluster();
  const [dsStatus, setDsStatus] = useState<DatasourceStatus | null>(null);
  const [live, setLive] = useState<AlertsQueryResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/datasource/alerts/status")
      .then((r) => r.json())
      .then(setDsStatus)
      .catch(() => setDsStatus({ configured: false }));
  }, []);

  useEffect(() => {
    if (!dsStatus?.configured) {
      setLive(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(withClusterParam("/api/datasource/alerts", selectedCluster))
      .then((r) => r.json())
      .then((result: AlertsQueryResult) => {
        if (!cancelled) setLive(result);
      })
      .catch((err) => {
        if (!cancelled) setLive({ status: "error", detail: err instanceof Error ? err.message : "Request failed." });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dsStatus, selectedCluster]);

  return { dsStatus, live, loading, isLive: live?.status === "connected" };
}
