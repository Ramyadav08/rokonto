"use client";

import { ObservexPanel } from "@/dashboard/types";
import { seededValue } from "@/mock/generator";
import { formatByUnit } from "@/lib/format";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function BarChartPanel({ panel }: { panel: ObservexPanel }) {
  const targets = panel.targets.length > 0 ? panel.targets : [{ refId: "A", expr: "" }];
  const data = targets.map((t) => ({
    name: t.legend || t.refId,
    value: seededValue(`bar-${panel.id}-${t.refId}`, panel.fieldConfig),
  }));
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
