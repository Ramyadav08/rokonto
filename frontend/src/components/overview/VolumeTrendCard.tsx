"use client";

import { useState } from "react";
import { ExpandableCard } from "@/components/ui/ExpandableCard";
import { NoDataMessage } from "./NoDataMessage";
import { cn } from "@/lib/cn";

type VolumeRange = "1h" | "6h" | "24h";
const VOLUME_RANGES: VolumeRange[] = ["1h", "6h", "24h"];

interface VolumeTrendCardProps {
  title: string;
  kind: "requests" | "errors";
  color: string;
}

// No backend mapping exists yet for request-volume or error-rate trends
// (needs a real request-metrics source per service, not just raw cluster
// metrics) -- shown as an honest empty state instead of a fabricated chart.
export function VolumeTrendCard({ title }: VolumeTrendCardProps) {
  const [range, setRange] = useState<VolumeRange>("1h");

  const controls = (
    <div className="flex overflow-hidden rounded-md border border-border text-xs">
      {VOLUME_RANGES.map((r) => (
        <button
          key={r}
          onClick={() => setRange(r)}
          className={cn(
            "px-2 py-1",
            r === range ? "bg-accent-blue text-white" : "bg-surface-raised text-text-secondary hover:bg-surface-hover"
          )}
        >
          {r}
        </button>
      ))}
    </div>
  );

  return (
    <ExpandableCard title={title} controls={controls} bodyClassName="h-56">
      <NoDataMessage label="No data source for this yet" />
    </ExpandableCard>
  );
}
