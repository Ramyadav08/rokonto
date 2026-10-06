import { ExpandableCard } from "@/components/ui/ExpandableCard";
import { NoDataMessage } from "./NoDataMessage";

// No backend mapping exists yet for per-namespace pod/CPU/memory breakdowns
// or per-node CPU distribution -- see ResourceFlow.tsx for the same
// reasoning. Shown as an honest empty state, not fabricated mock rows.
export function NamespaceBreakdown() {
  return (
    <ExpandableCard title="Namespace Breakdown" bodyClassName="grid grid-cols-1">
      <NoDataMessage label="No data source for this yet" />
    </ExpandableCard>
  );
}
