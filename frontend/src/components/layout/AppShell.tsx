"use client";

import { ReactNode, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ClusterProvider } from "@/lib/clusterContext";

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // The home/login/signup pages are reachable without a session by
  // definition, so they never get the authenticated app's sidebar/topbar
  // chrome around them. /platform/* is a completely separate portal
  // (internal staff, its own session/layout/sidebar in
  // src/app/platform/layout.tsx) -- it must never be wrapped in the tenant
  // app's chrome, which would otherwise render a "Not signed in" tenant
  // sidebar/topbar around every platform-admin page.
  if (pathname === "/" || pathname === "/login" || pathname === "/signup" || pathname?.startsWith("/platform")) {
    return <>{children}</>;
  }

  return (
    <ClusterProvider>
      <div className="flex h-dvh w-full overflow-hidden bg-background">
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
            <button
              className="flex-1 bg-black/60"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
            >
              <X className="ml-4 mt-4 h-5 w-5 text-white/70" />
            </button>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenuClick={() => setMobileOpen(true)} />
          <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </ClusterProvider>
  );
}
