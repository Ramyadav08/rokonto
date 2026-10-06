import { PlugZap } from "lucide-react";

/** No backend mapping exists yet for this widget (cluster-wide utilization
    normalization, "degraded deployment" classification, per-service
    breakdowns -- none have a clean single-query real-data source). Shown
    instead of fabricated numbers, which would misrepresent an empty/
    unconnected platform as having real traffic. */
export function NoDataMessage({ label = "No data source for this yet" }: { label?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 py-10 text-center text-xs text-text-muted">
      <PlugZap className="h-4 w-4" />
      {label}
    </div>
  );
}
