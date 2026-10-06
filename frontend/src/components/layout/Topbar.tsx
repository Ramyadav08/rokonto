"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { useSelectedCluster } from "@/lib/clusterContext";

const TITLES: { prefix: string; title: string }[] = [
  { prefix: "/overview", title: "Overview" },
  { prefix: "/dashboards", title: "Dashboards" },
  { prefix: "/explore/logs", title: "Explore · Logs" },
  { prefix: "/explore/metrics", title: "Explore · Metrics" },
  { prefix: "/explore/traces", title: "Explore · Traces" },
  { prefix: "/explore", title: "Explore" },
  { prefix: "/alerts", title: "Alerts" },
  { prefix: "/clusters", title: "Connect Cluster" },
  { prefix: "/uptime", title: "Uptime" },
];

function titleFor(pathname: string): string {
  const match = TITLES.find((t) => pathname.startsWith(t.prefix));
  return match?.title ?? "Observex";
}

interface GatewayCluster {
  id: string;
  name: string;
  env: string;
  fullAccess: boolean;
}

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname();
  const { selectedCluster, setSelectedCluster } = useSelectedCluster();
  const [clusters, setClusters] = useState<GatewayCluster[]>([]);

  useEffect(() => {
    fetch("/api/datasource/clusters")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: GatewayCluster[]) => setClusters(Array.isArray(list) ? list : []))
      .catch(() => setClusters([]));
  }, []);

  const options = [
    { label: "All clusters", value: "" },
    ...clusters.map((c) => ({ label: `${c.name} (${c.env})`, value: c.name })),
  ];

  return (
    <div className="flex h-12 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-md p-1.5 text-text-secondary hover:bg-surface-hover hover:text-text-primary lg:hidden"
          aria-label="Toggle navigation"
        >
          <Menu className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-text-primary">{titleFor(pathname)}</span>
      </div>
      <Select
        aria-label="Scope to cluster"
        options={options}
        value={selectedCluster ?? ""}
        onChange={(e) => setSelectedCluster(e.target.value || null)}
      />
    </div>
  );
}
