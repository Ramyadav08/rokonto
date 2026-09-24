"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/explore/logs", label: "Logs" },
  { href: "/explore/metrics", label: "Metrics" },
  { href: "/explore/traces", label: "Traces" },
];

export function ExploreTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 border-b border-border px-4">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "border-b-2 px-3 py-2.5 text-sm transition-colors",
              active
                ? "border-accent-blue text-text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
