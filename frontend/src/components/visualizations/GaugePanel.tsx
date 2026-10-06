"use client";

import { DashboardVariable, ObservexPanel } from "@/dashboard/types";
import { formatByUnit } from "@/lib/format";
import { colorForValue } from "@/lib/thresholds";
import { usePanelData, latestValue } from "@/dashboard/usePanelData";
import { PanelStatusMessage, PanelNoDataMessage } from "./PanelStatusMessage";
import { RadialBar, RadialBarChart, ResponsiveContainer, PolarAngleAxis } from "recharts";

export function GaugePanel({
  panel,
  timeRange,
  variables,
}: {
  panel: ObservexPanel;
  timeRange: string;
  variables?: DashboardVariable[];
}) {
  const live = usePanelData(panel, timeRange, variables);
  if (live.status !== "live") {
    return <PanelStatusMessage status={live.status} detail={live.detail} />;
  }
  if (live.series.length === 0) {
    return <PanelNoDataMessage />;
  }

  const min = panel.fieldConfig.min ?? 0;
  const max = panel.fieldConfig.max ?? 1;
  const value = latestValue(live.series[0]);
  const color = colorForValue(value, panel.fieldConfig.thresholds, max, panel.fieldConfig.unit);
  const percent = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  const data = [{ name: panel.title, value: percent, fill: color }];

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius="70%"
          outerRadius="100%"
          data={data}
          startAngle={225}
          endAngle={-45}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar
            background={{ fill: "#1a2029" }}
            dataKey="value"
            cornerRadius={6}
            isAnimationActive={false}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold tabular-nums" style={{ color }}>
          {formatByUnit(value, panel.fieldConfig.unit, panel.fieldConfig.decimals ?? 1)}
        </span>
      </div>
    </div>
  );
}
