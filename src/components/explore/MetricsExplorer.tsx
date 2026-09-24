"use client";

import { useMemo, useState } from "react";
import { Code2, SlidersHorizontal } from "lucide-react";
import { mockData } from "@/lib/mockData";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { formatByUnit, formatClock } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TIME_RANGE_PRESETS } from "@/dashboard/types";

const SERIES_COLORS = ["#3b82f6", "#8b5cf6", "#22c55e", "#eab308"];

export function MetricsExplorer() {
  const [mode, setMode] = useState<"builder" | "advanced">("builder");
  const [metric, setMetric] = useState(mockData.metricNames[0]);
  const [service, setService] = useState("all");
  const [namespace, setNamespace] = useState("all");
  const [pod, setPod] = useState("all");
  const [aggregation, setAggregation] = useState(mockData.aggregations[0]);
  const [groupBy, setGroupBy] = useState(mockData.groupByOptions[0]);
  const [timeRange, setTimeRange] = useState("now-1h");

  const data = useMemo(
    () => mockData.getMetricSeries({ metric, service, namespace, pod, aggregation, groupBy }),
    [metric, service, namespace, pod, aggregation, groupBy]
  );
  const unit = mockData.unitForMetric(metric);
  const seriesNames = Object.keys(data[0] ?? {}).filter((k) => k !== "time");

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex rounded-md border border-border p-0.5 text-xs">
          <button
            onClick={() => setMode("builder")}
            className={cn("flex items-center gap-1.5 rounded px-2.5 py-1", mode === "builder" ? "bg-surface-hover text-text-primary" : "text-text-muted")}
          >
            <SlidersHorizontal className="h-3 w-3" />
            Builder
          </button>
          <button
            onClick={() => setMode("advanced")}
            className={cn("flex items-center gap-1.5 rounded px-2.5 py-1", mode === "advanced" ? "bg-surface-hover text-text-primary" : "text-text-muted")}
          >
            <Code2 className="h-3 w-3" />
            Advanced
          </button>
        </div>
        <div className="ml-auto">
          <Select options={TIME_RANGE_PRESETS} value={timeRange} onChange={(e) => setTimeRange(e.target.value)} />
        </div>
      </div>

      {mode === "builder" ? (
        <Card className="mb-4 flex flex-wrap items-end gap-3 p-3">
          <Field label="Metric">
            <Select options={mockData.metricNames.map((m) => ({ label: m, value: m }))} value={metric} onChange={(e) => setMetric(e.target.value)} />
          </Field>
          <Field label="Service">
            <Select options={mockData.metricServices.map((s) => ({ label: s === "all" ? "All services" : s, value: s }))} value={service} onChange={(e) => setService(e.target.value)} />
          </Field>
          <Field label="Namespace">
            <Select options={mockData.metricNamespaces.map((n) => ({ label: n === "all" ? "All namespaces" : n, value: n }))} value={namespace} onChange={(e) => setNamespace(e.target.value)} />
          </Field>
          <Field label="Pod">
            <Select options={mockData.metricPods.map((p) => ({ label: p === "all" ? "All pods" : p, value: p }))} value={pod} onChange={(e) => setPod(e.target.value)} />
          </Field>
          <Field label="Aggregation">
            <Select options={mockData.aggregations.map((a) => ({ label: a, value: a }))} value={aggregation} onChange={(e) => setAggregation(e.target.value)} />
          </Field>
          <Field label="Group by">
            <Select options={mockData.groupByOptions.map((g) => ({ label: g, value: g }))} value={groupBy} onChange={(e) => setGroupBy(e.target.value)} />
          </Field>
        </Card>
      ) : (
        <Card className="mb-4 p-3">
          <div className="mb-1.5 text-xs text-text-muted">PromQL-style query (preview only)</div>
          <div className="rounded-md border border-border bg-surface-raised px-2.5 py-2 font-mono text-xs text-text-secondary">
            {aggregation.toLowerCase()}({metric}
            {`{service="${service}",namespace="${namespace}",pod="${pod}"}`}) by ({groupBy.toLowerCase()})
          </div>
        </Card>
      )}

      <Card className="min-h-[360px] flex-1 p-4">
        <ResponsiveContainer width="100%" height={360}>
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#1a2029" vertical={false} />
            <XAxis
              dataKey="time"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(v) => formatClock(v).slice(0, 5)}
              stroke="#6b7280"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#232a35" }}
              minTickGap={50}
            />
            <YAxis
              stroke="#6b7280"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(v) => formatByUnit(v, unit, 0)}
            />
            <Tooltip
              contentStyle={{ background: "#141922", border: "1px solid #232a35", borderRadius: 6, fontSize: 12 }}
              labelFormatter={(v) => formatClock(Number(v))}
              formatter={(value, name) => [formatByUnit(Number(value), unit, 2), String(name)]}
            />
            {seriesNames.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: "#9aa4b2" }} />}
            {seriesNames.map((name, i) => (
              <Area
                key={name}
                type="monotone"
                dataKey={name}
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                fillOpacity={0.12}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs text-text-muted">{label}</div>
      {children}
    </div>
  );
}
