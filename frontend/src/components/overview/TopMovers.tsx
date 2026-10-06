import { ExpandableCard } from "@/components/ui/ExpandableCard";
import { NoDataMessage } from "./NoDataMessage";

// No backend mapping exists yet for per-service resource-change tracking
// (needs historical per-service CPU snapshots, not just a point-in-time
// cluster metric) -- shown as an honest empty state instead of fabricated
// rows.
export function TopMovers() {
  return (
    <ExpandableCard title="Top Services by Resource Change" bodyClassName="overflow-x-auto">
      <NoDataMessage label="No data source for this yet" />
    </ExpandableCard>
  );
}
