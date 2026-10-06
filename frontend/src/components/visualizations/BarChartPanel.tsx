"use client";

import { DashboardVariable, ObservexPanel } from "@/dashboard/types";
import { formatByUnit } from "@/lib/format";
import { usePanelData, latestValue, displayName } from "@/dashboard/usePanelData";
import { PanelStatusMessage, PanelNoDataMessage } from "./PanelStatusMessage";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function BarChartPanel({
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

  const data = live.series.map((s) => ({ name: displayName(s), value: latestValue(s) }));
  const unit = panel.fieldConfig.unit;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#1a2029" vertical={false} />
        <XAxis dataKey="name" stroke="#6b7280" tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#232a35" }} />
        <YAxis
          stroke="#6b7280"
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v) => formatByUnit(v, unit, 0)}
        />
        <Tooltip
          contentStyle={{ background: "#141922", border: "1px solid #232a35", borderRadius: 6, fontSize: 12 }}
          formatter={(value) => formatByUnit(Number(value), unit, 2)}
        />
        <Bar dataKey="value" fill="#3b82f6" radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
