import dynamic from "next/dynamic";
import { ExploreTabs } from "@/components/explore/ExploreTabs";

// Mock traces use random ids generated at module load time, so they must
// only ever be generated client-side -- see explore/logs/page.tsx for why.
const TracesExplorer = dynamic(
  () => import("@/components/explore/TracesExplorer").then((m) => m.TracesExplorer),
  { ssr: false }
);

export default function ExploreTracesPage() {
  return (
    <div className="flex h-full flex-col">
      <ExploreTabs />
      <div className="min-h-0 flex-1">
        <TracesExplorer />
      </div>
    </div>
  );
}
