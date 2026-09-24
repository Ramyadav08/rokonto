"use client";

import { usePathname } from "next/navigation";
import { Menu, Server } from "lucide-react";

const TITLES: { prefix: string; title: string }[] = [
  { prefix: "/overview", title: "Overview" },
  { prefix: "/dashboards", title: "Dashboards" },
  { prefix: "/explore/logs", title: "Explore · Logs" },
  { prefix: "/explore/metrics", title: "Explore · Metrics" },
  { prefix: "/explore/traces", title: "Explore · Traces" },
  { prefix: "/explore", title: "Explore" },
  { prefix: "/alerts", title: "Alerts" },
];

function titleFor(pathname: string): string {
  const match = TITLES.find((t) => pathname.startsWith(t.prefix));
  return match?.title ?? "Observex";
}

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname();

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
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface-raised px-2.5 py-1 text-xs text-text-secondary">
        <Server className="h-3.5 w-3.5" />
        prod-cluster-01
        <span className="h-1.5 w-1.5 rounded-full bg-status-healthy" />
      </div>
    </div>
  );
}
