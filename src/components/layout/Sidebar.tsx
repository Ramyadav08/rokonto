"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bell, Compass, LayoutGrid, Gauge } from "lucide-react";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { href: "/overview", label: "Overview", icon: Gauge },
  { href: "/dashboards", label: "Dashboards", icon: LayoutGrid },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/alerts", label: "Alerts", icon: Bell },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-56 flex-col border-r border-border bg-surface">
      <div className="flex h-12 items-center gap-2 border-b border-border px-4">
        <Activity className="h-5 w-5 text-accent-blue" strokeWidth={2.25} />
        <span className="text-sm font-semibold tracking-tight text-text-primary">Observex</span>
      </div>
      <nav className="flex flex-col gap-0.5 p-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-accent-blue/10 text-accent-blue"
                  : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-border p-3 text-xs text-text-muted">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-status-warning" />
          Mock data mode
        </div>
      </div>
    </div>
  );
}
