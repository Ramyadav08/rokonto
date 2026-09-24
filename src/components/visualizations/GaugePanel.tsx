"use client";

import { ObservexPanel } from "@/dashboard/types";
import { seededValue } from "@/mock/generator";
import { formatByUnit } from "@/lib/format";
import { colorForValue } from "@/lib/thresholds";
import { RadialBar, RadialBarChart, ResponsiveContainer, PolarAngleAxis } from "recharts";

export function GaugePanel({ panel }: { panel: ObservexPanel }) {
  const min = panel.fieldConfig.min ?? 0;
  const max = panel.fieldConfig.max ?? 1;
  const value = seededValue(`gauge-${panel.id}-${panel.title}`, panel.fieldConfig);
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
