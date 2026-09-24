"use client";

import Link from "next/link";
import { LayoutGrid, Trash2 } from "lucide-react";
import { ObservexDashboard } from "@/dashboard/types";
import { Card } from "@/components/ui/Card";

export function DashboardCard({
  dashboard,
  onDelete,
}: {
  dashboard: ObservexDashboard;
  onDelete?: (dashboard: ObservexDashboard) => void;
}) {
  const panelCount = dashboard.panels.filter((p) => p.type !== "row").length;

  return (
    <Card className="group relative flex flex-col gap-2 p-4 transition-colors hover:border-accent-blue/40">
      <Link href={`/dashboards/${dashboard.id}`} className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-accent-blue">
          <LayoutGrid className="h-4 w-4" />
          <span className="text-sm font-medium text-text-primary">{dashboard.title}</span>
        </div>
        {dashboard.description && (
          <p className="line-clamp-2 text-xs text-text-muted">{dashboard.description}</p>
        )}
        <div className="mt-1 flex items-center gap-2 text-xs text-text-muted">
          <span>{panelCount} panels</span>
          {dashboard.tags.length > 0 && (
            <>
              <span>·</span>
              <span className="truncate">{dashboard.tags.slice(0, 3).join(", ")}</span>
            </>
          )}
        </div>
      </Link>
      {onDelete && (
        <button
          onClick={() => onDelete(dashboard)}
          className="absolute right-3 top-3 rounded p-1 text-text-muted opacity-0 hover:bg-surface-hover hover:text-status-critical group-hover:opacity-100"
          aria-label={`Delete ${dashboard.title}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </Card>
  );
}
