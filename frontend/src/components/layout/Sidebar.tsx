"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Activity, Bell, Compass, LayoutGrid, Gauge, HeartPulse, Link2, ShieldCheck, LogOut } from "lucide-react";
import { cn } from "@/lib/cn";
import { useSession } from "@/lib/useSession";

const NAV_ITEMS = [
  { href: "/overview", label: "Overview", icon: Gauge },
  { href: "/dashboards", label: "Dashboards", icon: LayoutGrid },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/clusters", label: "Connect Cluster", icon: Link2 },
  { href: "/uptime", label: "Uptime", icon: HeartPulse },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useSession();

  const navItems = user?.role === "admin" ? [...NAV_ITEMS, { href: "/admin", label: "Admin", icon: ShieldCheck }] : NAV_ITEMS;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-full w-56 flex-col border-r border-border bg-surface">
      <div className="flex h-12 items-center gap-2 border-b border-border px-4">
        <Activity className="h-5 w-5 text-accent-blue" strokeWidth={2.25} />
        <span className="text-sm font-semibold tracking-tight text-text-primary">Observex</span>
      </div>
      <nav className="flex flex-col gap-0.5 p-2">
        {navItems.map((item) => {
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
        {user ? (
          <div className="flex items-center justify-between gap-1.5">
            <span className="truncate" title={user.email}>
              {user.email}
            </span>
            <button
              onClick={handleLogout}
              className="shrink-0 rounded p-1 text-text-muted hover:bg-surface-hover hover:text-text-primary"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-status-warning" />
            Not signed in
          </div>
        )}
      </div>
    </div>
  );
}
