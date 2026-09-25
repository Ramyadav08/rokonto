"use client";

import { useMemo, useState } from "react";
import { Code2, SlidersHorizontal } from "lucide-react";
import { mockData } from "@/lib/mockData";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { formatByUnit, formatClock } from "@/lib/format";
import { LogCorrelationTooltip } from "@/components/charts/LogCorrelationTooltip";
import { readChartClick, useLogDrilldown } from "@/lib/logCorrelation";
import { parsePromQL } from "@/lib/promqlQuery";
import { cn } from "@/lib/cn";
import type { MetricQuery } from "@/mock/metrics";
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

function toPromQLString(q: MetricQuery): string {
  return `${q.aggregation.toLowerCase()}(${q.metric}{service="${q.service}",namespace="${q.namespace}",pod="${q.pod}"}) by (${q.groupBy.toLowerCase()})`;
}

export function MetricsExplorer() {
  const [mode, setMode] = useState<"builder" | "advanced">("builder");
  const [metric, setMetric] = useState(mockData.metricNames[0]);
  const [service, setService] = useState("all");
  const [namespace, setNamespace] = useState("all");
  const [pod, setPod] = useState("all");
  const [aggregation, setAggregation] = useState(mockData.aggregations[0]);
  const [groupBy, setGroupBy] = useState(mockData.groupByOptions[0]);
  const [timeRange, setTimeRange] = useState("now-1h");
  const [advancedQuery, setAdvancedQuery] = useState(() =>
    toPromQLString({ metric, service, namespace, pod, aggregation, groupBy })
  );

  const parsedAdvanced = useMemo(() => parsePromQL(advancedQuery), [advancedQuery]);
  const effectiveQuery: MetricQuery = useMemo(
    () => (mode === "advanced" ? parsedAdvanced.query : { metric, service, namespace, pod, aggregation, groupBy }),
    [mode, parsedAdvanced, metric, service, namespace, pod, aggregation, groupBy]
  );

  const data = useMemo(() => mockData.getMetricSeries(effectiveQuery), [effectiveQuery]);
  const unit = mockData.unitForMetric(effectiveQuery.metric);
  const seriesNames = Object.keys(data[0] ?? {}).filter((k) => k !== "time");
  const goToLogs = useLogDrilldown();

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
          <div className="mb-1.5 text-xs text-text-muted">
            PromQL-style query -- runs against mock data, not a real Prometheus
          </div>
          <input
            className="w-full rounded-md border border-border bg-surface-raised px-2.5 py-2 font-mono text-xs text-text-primary outline-none focus:border-accent-blue"
            value={advancedQuery}
            onChange={(e) => setAdvancedQuery(e.target.value)}
            spellCheck={false}
            placeholder='sum(container_cpu_usage{service="api-gateway"}) by (pod)'
          />
          <div className="mt-1.5 text-xs text-text-muted">
            {parsedAdvanced.recognized ? (
              <>
                Parsed as: metric <span className="text-text-secondary">{effectiveQuery.metric}</span>, aggregation{" "}
                <span className="text-text-secondary">{effectiveQuery.aggregation}</span>, group by{" "}
                <span className="text-text-secondary">{effectiveQuery.groupBy}</span>
                {effectiveQuery.service !== "all" && (
                  <>
                    , service <span className="text-text-secondary">{effectiveQuery.service}</span>
                  </>
                )}
              </>
            ) : (
              "Couldn't fully parse this as a query -- treating it as a bare metric name."
            )}
          </div>
        </Card>
      )}

      <Card className="min-h-[360px] flex-1 p-4">
        <ResponsiveContainer width="100%" height={360}>
          <AreaChart
            data={data}
            margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
            className="cursor-pointer"
            onClick={(state) => {
              const click = readChartClick(state);
              if (click) goToLogs(click.timestamp, effectiveQuery.service !== "all" ? effectiveQuery.service : click.seriesName);
            }}
          >
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
              content={({ active, label, payload }) =>
                active && label !== undefined && payload?.[0] ? (
                  <LogCorrelationTooltip
                    timestamp={Number(label)}
                    hint={
                      effectiveQuery.service !== "all"
                        ? effectiveQuery.service
                        : payload[0].name
                          ? String(payload[0].name)
                          : undefined
                    }
                    valueLine={`${payload[0].name}: ${formatByUnit(Number(payload[0].value), unit, 2)}`}
                  />
                ) : null
              }
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
