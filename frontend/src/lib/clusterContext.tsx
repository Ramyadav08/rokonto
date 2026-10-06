"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "observex.selectedCluster";

interface ClusterContextValue {
  /** null = "All clusters" -- the existing default (unscoped) behavior. */
  selectedCluster: string | null;
  setSelectedCluster: (cluster: string | null) => void;
}

const ClusterContext = createContext<ClusterContextValue>({
  selectedCluster: null,
  setSelectedCluster: () => {},
});

function loadSelectedCluster(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function saveSelectedCluster(cluster: string | null): void {
  try {
    if (cluster) {
      window.localStorage.setItem(STORAGE_KEY, cluster);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage unavailable (private browsing etc.) -- selection just won't persist.
  }
}

/** Wraps the authenticated app shell. Only the browser needs to remember the
    selection across page loads (every datasource fetch is same-origin, made
    by the browser itself), so localStorage is enough -- no cookie/server
    round-trip needed. */
export function ClusterProvider({ children }: { children: ReactNode }) {
  const [selectedCluster, setSelectedClusterState] = useState<string | null>(null);

  // Read localStorage only after mount, so SSR and first client render agree
  // (no flash of a persisted value that the server could never have known).
  useEffect(() => {
    setSelectedClusterState(loadSelectedCluster());
  }, []);

  function setSelectedCluster(cluster: string | null) {
    setSelectedClusterState(cluster);
    saveSelectedCluster(cluster);
  }

  return <ClusterContext.Provider value={{ selectedCluster, setSelectedCluster }}>{children}</ClusterContext.Provider>;
}

export function useSelectedCluster(): ClusterContextValue {
  return useContext(ClusterContext);
}

/** Appends `cluster=<value>` to a /api/datasource/* request URL when a
    specific cluster is selected, omitted entirely for "All clusters" (never
    sent as an empty string). */
export function withClusterParam(url: string, selectedCluster: string | null): string {
  if (!selectedCluster) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}cluster=${encodeURIComponent(selectedCluster)}`;
}
