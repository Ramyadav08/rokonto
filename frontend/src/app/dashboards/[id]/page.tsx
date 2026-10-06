"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft } from "lucide-react";
import { ObservexDashboard } from "@/dashboard/types";
import { mockData } from "@/lib/mockData";

// Panel visualizations generate mock values from Math.random()/Date.now();
// keep the whole dashboard canvas client-only so it can never be SSR'd with
// output that would differ from the client's first paint -- see
// explore/logs/page.tsx for the fuller explanation.
const Dashboard = dynamic(() => import("@/components/dashboard/Dashboard").then((m) => m.Dashboard), {
  ssr: false,
});

export default function DashboardDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<ObservexDashboard | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    mockData.getDashboard(params.id).then((d) => {
      if (!cancelled) setDashboard(d ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (dashboard === undefined) {
    return <div className="p-6 text-sm text-text-muted">Loading dashboard…</div>;
  }

  if (dashboard === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-text-primary">Dashboard not found.</p>
        <button
          onClick={() => router.push("/dashboards")}
          className="flex items-center gap-1.5 text-sm text-accent-blue hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to dashboards
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 pt-2">
        <Link
          href="/dashboards"
          className="inline-flex items-center gap-1.5 pb-2 text-xs text-text-muted hover:text-text-primary"
        >
          <ArrowLeft className="h-3 w-3" />
          Dashboards
        </Link>
      </div>
      <div className="min-h-0 flex-1">
        <Dashboard initial={dashboard} />
      </div>
    </div>
  );
}
