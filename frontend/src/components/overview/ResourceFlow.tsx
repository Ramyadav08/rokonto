"use client";

import { useState } from "react";
import { ExpandableCard } from "@/components/ui/ExpandableCard";
import { Select } from "@/components/ui/Select";
import { NoDataMessage } from "./NoDataMessage";

// No backend mapping exists for a cluster -> namespace -> service resource
// breakdown yet (it needs a real service-topology source, not just raw
// metrics), so this renders an honest empty state instead of the Sankey it
// used to fabricate from mock data.
export function ResourceFlow() {
  const [metric, setMetric] = useState<"cpu" | "memory">("cpu");

  const controls = (
    <Select
      options={[
        { label: "CPU", value: "cpu" },
        { label: "Memory", value: "memory" },
      ]}
      value={metric}
      onChange={(e) => setMetric(e.target.value as "cpu" | "memory")}
    />
  );

  return (
    <ExpandableCard title="Resource Usage Breakdown" controls={controls} bodyClassName="h-80">
      <NoDataMessage label="No data source for this yet" />
    </ExpandableCard>
  );
}
