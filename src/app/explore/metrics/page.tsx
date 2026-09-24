import dynamic from "next/dynamic";
import { ExploreTabs } from "@/components/explore/ExploreTabs";

// Mock series are generated relative to Date.now(), so keep this client-only
// -- see explore/logs/page.tsx for why.
const MetricsExplorer = dynamic(
  () => import("@/components/explore/MetricsExplorer").then((m) => m.MetricsExplorer),
  { ssr: false }
);

export default function ExploreMetricsPage() {
  return (
    <div className="flex h-full flex-col">
      <ExploreTabs />
      <div className="min-h-0 flex-1">
        <MetricsExplorer />
      </div>
    </div>
  );
}
