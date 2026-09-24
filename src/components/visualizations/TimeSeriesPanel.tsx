"use client";

import { ObservexPanel } from "@/dashboard/types";
import { generateTimeSeries, seriesNamesForPanel } from "@/mock/generator";
import { formatByUnit, formatClock } from "@/lib/format";
import { LogCorrelationTooltip } from "@/components/charts/LogCorrelationTooltip";
import { readChartClick, useLogDrilldown } from "@/lib/logCorrelation";
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

const SERIES_COLORS = ["#3b82f6", "#8b5cf6", "#22c55e", "#eab308", "#ef4444", "#06b6d4"];

export function TimeSeriesPanel({ panel }: { panel: ObservexPanel }) {
  const names = seriesNamesForPanel(panel);
  const data = generateTimeSeries(`ts-${panel.id}`, names, panel.fieldConfig, 30);
  const unit = panel.fieldConfig.unit;
  const goToLogs = useLogDrilldown();

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
        className="cursor-pointer"
        onClick={(state, event) => {
          // This panel lives inside DashboardPanel's click-to-fullscreen
          // body; stop the click from also triggering that.
          event.stopPropagation();
          const click = readChartClick(state);
          if (click) goToLogs(click.timestamp, click.seriesName);
        }}
      >
        <defs>
          {names.map((name, i) => (
            <linearGradient key={name} id={`grad-${panel.id}-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES_COLORS[i % SERIES_COLORS.length]} stopOpacity={0.35} />
              <stop offset="100%" stopColor={SERIES_COLORS[i % SERIES_COLORS.length]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="#1a2029" vertical={false} />
        <XAxis
          dataKey="time"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(v) => formatClock(v).slice(0, 5)}
          stroke="#6b7280"
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: "#232a35" }}
          minTickGap={40}
        />
        <YAxis
          stroke="#6b7280"
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v) => formatByUnit(v, unit, 0)}
        />
        <Tooltip
          content={({ active, label, payload }) =>
            active && label !== undefined && payload?.[0] ? (
              <LogCorrelationTooltip
                timestamp={Number(label)}
                hint={payload[0].name ? String(payload[0].name) : undefined}
                valueLine={`${payload[0].name}: ${formatByUnit(Number(payload[0].value), unit, 2)}`}
              />
            ) : null
          }
        />
        {names.length > 1 && (
          <Legend wrapperStyle={{ fontSize: 11, color: "#9aa4b2" }} height={20} />
        )}
        {names.map((name, i) => (
          <Area
            key={name}
            type="monotone"
            dataKey={name}
            stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
            fill={`url(#grad-${panel.id}-${i})`}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
