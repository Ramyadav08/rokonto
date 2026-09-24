import dynamic from "next/dynamic";
import { ExploreTabs } from "@/components/explore/ExploreTabs";

// Mock log data is generated with random ids and "now"-relative timestamps.
// Rendering it during SSR produces output that differs from the client's
// first render (different process, different Date.now()/Math.random()),
// which React flags as a hydration mismatch. Since a real backend would be
// fetched client-side asynchronously anyway, we skip SSR here entirely.
const LogsExplorer = dynamic(
  () => import("@/components/explore/LogsExplorer").then((m) => m.LogsExplorer),
  { ssr: false }
);

export default function ExploreLogsPage() {
  return (
    <div className="flex h-full flex-col">
      <ExploreTabs />
      <div className="min-h-0 flex-1">
        <LogsExplorer />
      </div>
    </div>
  );
}
