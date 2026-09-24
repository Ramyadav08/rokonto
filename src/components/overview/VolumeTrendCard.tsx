"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getVolumeSeries, VOLUME_RANGES, type VolumeRange } from "@/mock/overview";
import { formatByUnit, formatClock } from "@/lib/format";
import { ExpandableCard } from "@/components/ui/ExpandableCard";
import { LogCorrelationTooltip } from "@/components/charts/LogCorrelationTooltip";
import { readChartClick, useLogDrilldown } from "@/lib/logCorrelation";
import { cn } from "@/lib/cn";

interface VolumeTrendCardProps {
  title: string;
  kind: "requests" | "errors";
  color: string;
}

export function VolumeTrendCard({ title, kind, color }: VolumeTrendCardProps) {
  const [range, setRange] = useState<VolumeRange>("1h");
  const data = getVolumeSeries(kind, range);
  const unit = kind === "requests" ? "none" : "percent";
  const seriesName = kind === "requests" ? "Requests/min" : "Error Rate";
  const goToLogs = useLogDrilldown();

  const controls = (
    <div className="flex overflow-hidden rounded-md border border-border text-xs">
      {VOLUME_RANGES.map((r) => (
        <button
          key={r}
          onClick={() => setRange(r)}
          className={cn(
            "px-2 py-1",
            r === range ? "bg-accent-blue text-white" : "bg-surface-raised text-text-secondary hover:bg-surface-hover"
          )}
        >
          {r}
        </button>
      ))}
    </div>
  );

  return (
    <ExpandableCard title={title} controls={controls} bodyClassName="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
          onClick={(e) => {
            const click = readChartClick(e);
            if (click) goToLogs(click.timestamp);
          }}
          className="cursor-pointer"
        >
          <defs>
            <linearGradient id={`grad-volume-${kind}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
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
                  valueLine={`${seriesName}: ${formatByUnit(Number(payload[0].value), unit, 2)}`}
                />
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey={seriesName}
            stroke={color}
            fill={`url(#grad-volume-${kind})`}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ExpandableCard>
  );
}
