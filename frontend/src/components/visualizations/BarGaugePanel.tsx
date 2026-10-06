"use client";

import { DashboardVariable, ObservexPanel } from "@/dashboard/types";
import { formatByUnit } from "@/lib/format";
import { colorForValue } from "@/lib/thresholds";
import { usePanelData, latestValue, displayName } from "@/dashboard/usePanelData";
import { PanelStatusMessage, PanelNoDataMessage } from "./PanelStatusMessage";

export function BarGaugePanel({
  panel,
  timeRange,
  variables,
}: {
  panel: ObservexPanel;
  timeRange: string;
  variables?: DashboardVariable[];
}) {
  const min = panel.fieldConfig.min ?? 0;
  const max = panel.fieldConfig.max ?? 1;
  const live = usePanelData(panel, timeRange, variables);
  if (live.status !== "live") {
    return <PanelStatusMessage status={live.status} detail={live.detail} />;
  }
  if (live.series.length === 0) {
    return <PanelNoDataMessage />;
  }

  // One bar per real series -- a "by (...)" query can fan a single target
  // out into several, each labeled with its real Grafana legend (or its raw
  // label-based name if the target didn't configure one).
  const rows = live.series.map((s) => ({ key: displayName(s), label: displayName(s), value: latestValue(s) }));

  return (
    // justify-start (not center): a centered flex container clips content
    // above the fold when it overflows, and scrolling can't reach it --
    // real dashboards often pack more bars than fit a short panel.
    <div className="flex h-full flex-col justify-start gap-2.5 overflow-y-auto py-1">
      {rows.map((row) => {
        const color = colorForValue(row.value, panel.fieldConfig.thresholds, max, panel.fieldConfig.unit);
        const percent = Math.min(100, Math.max(0, ((row.value - min) / (max - min)) * 100));

        return (
          <div key={row.key} className="px-1">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="truncate text-text-secondary">{row.label}</span>
              <span className="font-medium tabular-nums" style={{ color }}>
                {formatByUnit(row.value, panel.fieldConfig.unit, panel.fieldConfig.decimals ?? 1)}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
              <div
                className="h-full rounded-full transition-[width]"
                style={{ width: `${percent}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
