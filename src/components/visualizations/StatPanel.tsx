"use client";

import { ObservexPanel } from "@/dashboard/types";
import { seededValue, generateTimeSeries } from "@/mock/generator";
import { formatByUnit } from "@/lib/format";
import { colorForValue } from "@/lib/thresholds";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

export function StatPanel({ panel }: { panel: ObservexPanel }) {
  const value = seededValue(`stat-${panel.id}-${panel.title}`, panel.fieldConfig);
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

  const spark = generateTimeSeries(`stat-${panel.id}`, ["value"], panel.fieldConfig, 20);

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
