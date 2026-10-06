import { AlertTriangle, Loader2, PlugZap, SearchX } from "lucide-react";
import type { UsePanelDataResult } from "@/dashboard/usePanelData";

/** A genuinely connected query that matched nothing -- e.g. a metric this
    cluster's scrape config just doesn't expose. Distinct from an error: the
    datasource is fine, this specific query just has no data right now. */
export function PanelNoDataMessage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 px-3 text-center text-xs text-text-muted">
      <SearchX className="h-4 w-4" />
      No data for this query
    </div>
  );
}

/** Shown in place of a panel's chart/value whenever `usePanelData` isn't
    "live" -- deliberately not a mock number, so a real datasource problem is
    visible instead of being disguised as working data. */
export function PanelStatusMessage({ status, detail }: Pick<UsePanelDataResult, "status" | "detail"> ) {
  if (status === "loading") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1.5 text-xs text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }
  if (status === "not_configured") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1.5 px-3 text-center text-xs text-text-muted">
        <PlugZap className="h-4 w-4" />
        Not signed in
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 px-3 text-center text-xs text-status-warning" title={detail}>
      <AlertTriangle className="h-4 w-4" />
      Datasource error
      {detail && <span className="max-w-[220px] truncate text-text-muted">{detail}</span>}
    </div>
  );
}
