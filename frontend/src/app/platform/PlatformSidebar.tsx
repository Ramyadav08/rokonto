"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LifeBuoy, LogOut, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { usePlatformSession } from "@/lib/usePlatformSession";

const NAV_ITEMS = [
  { href: "/platform/tenants", label: "Clients", icon: Users },
  { href: "/platform/tickets", label: "Support Tickets", icon: LifeBuoy },
];

export function PlatformSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { admin } = usePlatformSession();

  async function handleLogout() {
    await fetch("/api/platform/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/platform/login");
    router.refresh();
  }

  return (
    <div className="flex h-full w-56 flex-col border-r border-border bg-surface">
      <div className="flex h-12 items-center gap-2 border-b border-border px-4">
        <ShieldCheck className="h-5 w-5 text-accent-blue" strokeWidth={2.25} />
        <div>
          <span className="block text-sm font-semibold leading-tight tracking-tight text-text-primary">Observex</span>
          <span className="block text-[10px] leading-tight text-text-muted">Internal</span>
        </div>
      </div>
      <nav className="flex flex-col gap-0.5 p-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
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
        {admin ? (
          <div className="flex items-center justify-between gap-1.5">
            <span className="truncate" title={admin.email}>
              {admin.email}
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
