"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PlatformSidebar } from "./PlatformSidebar";

// Distinct shell for the internal platform portal -- deliberately not the
// tenant AppShell/Sidebar (separate auth, separate audience). Mirrors
// AppShell's own "/login has no chrome" exclusion for /platform/login.
export default function PlatformLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/platform/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <PlatformSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
