"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ObservexDashboard } from "@/dashboard/types";
import { mockData } from "@/lib/mockData";
import { Button } from "@/components/ui/Button";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { NewDashboardModal } from "@/components/dashboard/NewDashboardModal";
import { ImportDashboardButton } from "@/components/dashboard/ImportDashboardButton";

export default function DashboardsPage() {
  const router = useRouter();
  const [dashboards, setDashboards] = useState<ObservexDashboard[] | null>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    mockData.listDashboards().then(setDashboards);
  }, []);

  function handleCreate(dashboard: ObservexDashboard) {
    mockData.saveDashboard(dashboard);
    router.push(`/dashboards/${dashboard.id}`);
  }

  function handleDelete(dashboard: ObservexDashboard) {
    if (!mockData.isUserManaged(dashboard)) return;
    mockData.deleteDashboard(dashboard.id);
    setDashboards((prev) => prev?.filter((d) => d.id !== dashboard.id) ?? null);
  }

  const builtins = dashboards?.filter((d) => d.source === "builtin") ?? [];
  const userDashboards = dashboards?.filter((d) => d.source !== "builtin") ?? [];

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Dashboards</h1>
          <p className="text-sm text-text-muted">Default dashboards plus anything you create or import.</p>
        </div>
        <div className="flex items-center gap-2">
          <ImportDashboardButton onImported={(d) => router.push(`/dashboards/${d.id}`)} />
          <Button variant="primary" onClick={() => setShowNew(true)}>
            <Plus className="h-3.5 w-3.5" />
            New Dashboard
          </Button>
        </div>
      </div>

      {!dashboards && <div className="text-sm text-text-muted">Loading dashboards…</div>}

      {dashboards && (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
              Default dashboards
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {builtins.map((d) => (
                <DashboardCard key={d.id} dashboard={d} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
              My dashboards
            </h2>
            {userDashboards.length === 0 ? (
              <p className="text-sm text-text-muted">
                Nothing here yet — create a new dashboard or import one from JSON.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {userDashboards.map((d) => (
                  <DashboardCard key={d.id} dashboard={d} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {showNew && <NewDashboardModal onCreate={handleCreate} onClose={() => setShowNew(false)} />}
    </div>
  );
}
