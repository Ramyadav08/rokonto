import dynamic from "next/dynamic";
import { ExploreTabs } from "@/components/explore/ExploreTabs";

// Logs are fetched client-side (useSearchParams + a session-scoped fetch to
// query-gateway), so there's nothing useful to render on the server -- skip
// SSR entirely rather than rendering a loading shell twice.
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
