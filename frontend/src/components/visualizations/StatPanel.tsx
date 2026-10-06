"use client";

import { DashboardVariable, ObservexPanel } from "@/dashboard/types";
import { formatByUnit } from "@/lib/format";
import { colorForValue } from "@/lib/thresholds";
import { usePanelData, latestValue } from "@/dashboard/usePanelData";
import { PanelStatusMessage, PanelNoDataMessage } from "./PanelStatusMessage";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

export function StatPanel({
  panel,
  timeRange,
  variables,
}: {
  panel: ObservexPanel;
  timeRange: string;
  variables?: DashboardVariable[];
}) {
  const live = usePanelData(panel, timeRange, variables);
  const isLive = live.status === "live";

  if (!isLive) {
    return <PanelStatusMessage status={live.status} detail={live.detail} />;
  }
  if (live.series.length === 0) {
    return <PanelNoDataMessage />;
  }

  const primary = live.series[0];
  const value = latestValue(primary);
  const color = colorForValue(value, panel.fieldConfig.thresholds, panel.fieldConfig.max, panel.fieldConfig.unit);
  const formatted = formatByUnit(value, panel.fieldConfig.unit, panel.fieldConfig.decimals ?? 1);

  // Grafana dashboards often pack tiny stat tiles (e.g. a 2x2-unit "CPU
  // Cores" tile). The full value+label+sparkline layout below doesn't fit
  // in that little space, so fall back to just the number.
  const compact = panel.gridPos.w <= 3 || panel.gridPos.h <= 3;

  if (compact) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-0.5 overflow-hidden text-center">
        <div className="truncate text-lg font-semibold tabular-nums leading-none" style={{ color }}>
          {formatted}
        </div>
        <div className="w-full truncate text-[10px] text-text-muted" title={panel.title}>
          {panel.title}
        </div>
      </div>
    );
  }

  const spark = (primary?.points ?? []).map((p) => ({ time: p.time, value: p.value }));

  return (
    <div className="flex h-full items-center gap-4 px-1">
      <div className="min-w-0 flex-1">
        <div className="text-2xl font-semibold tabular-nums" style={{ color }}>
          {formatted}
        </div>
        <div className="mt-0.5 truncate text-xs text-text-muted">{panel.title}</div>
      </div>
      <div className="h-10 w-24 shrink-0 opacity-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={spark}>
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              fill={color}
              fillOpacity={0.15}
              strokeWidth={1.5}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
