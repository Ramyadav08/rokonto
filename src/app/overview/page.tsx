import dynamic from "next/dynamic";
import { KpiStrip } from "@/components/overview/KpiStrip";
import { ResourceFlow } from "@/components/overview/ResourceFlow";
import { NamespaceBreakdown } from "@/components/overview/NamespaceBreakdown";
import { TopMovers } from "@/components/overview/TopMovers";
import { RecentProblems } from "@/components/overview/RecentProblems";

// Trend series are generated relative to Date.now(), so keep them
// client-only to avoid SSR/hydration divergence -- see
// explore/logs/page.tsx for the fuller explanation. Everything else on this
// page is deterministic (seeded, no Date.now/Math.random) and safe to SSR.
const VolumeTrendCard = dynamic(
  () => import("@/components/overview/VolumeTrendCard").then((m) => m.VolumeTrendCard),
  { ssr: false }
);

export default function OverviewPage() {
  return (
    <div className="space-y-4 p-6">
      <KpiStrip />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <ResourceFlow />
          <NamespaceBreakdown />
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <VolumeTrendCard title="Request Volume" kind="requests" color="#3b82f6" />
            <VolumeTrendCard title="Error Rate" kind="errors" color="#ef4444" />
          </div>
          <TopMovers />
        </div>
      </div>

      <RecentProblems />
    </div>
  );
}
