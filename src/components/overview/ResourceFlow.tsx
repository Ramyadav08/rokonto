"use client";

import { useState } from "react";
import { Sankey, ResponsiveContainer, Tooltip, Rectangle, type SankeyNodeProps } from "recharts";
import { getResourceFlow } from "@/mock/overview";
import { ExpandableCard } from "@/components/ui/ExpandableCard";
import { Select } from "@/components/ui/Select";

const NODE_COLORS = ["#3b82f6", "#8b5cf6", "#22c55e", "#eab308", "#06b6d4", "#f97316"];

function FlowNode({ x, y, width, height, index, payload }: SankeyNodeProps) {
  const color = NODE_COLORS[index % NODE_COLORS.length];
  const isRoot = index === 0;
  return (
    <g>
      <Rectangle x={x} y={y} width={width} height={height} fill={color} fillOpacity={0.9} radius={2} />
      <text
        x={isRoot ? x + width + 8 : x - 8}
        y={y + height / 2}
        textAnchor={isRoot ? "start" : "end"}
        dominantBaseline="middle"
        fontSize={11}
        fill="#9aa4b2"
      >
        {payload.name}
      </text>
    </g>
  );
}

export function ResourceFlow() {
  const [metric, setMetric] = useState<"cpu" | "memory">("cpu");
  const flow = getResourceFlow(metric);

  const controls = (
    <Select
      options={[
        { label: "CPU", value: "cpu" },
        { label: "Memory", value: "memory" },
      ]}
      value={metric}
      onChange={(e) => setMetric(e.target.value as "cpu" | "memory")}
    />
  );

  return (
    <ExpandableCard title="Resource Usage Breakdown" controls={controls} bodyClassName="h-80">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-xs text-text-muted">Total allocated</span>
        <span className="text-sm font-semibold text-text-primary">{flow.total}</span>
      </div>
      <ResponsiveContainer width="100%" height="90%">
        <Sankey
          data={{ nodes: flow.nodes, links: flow.links }}
          node={FlowNode}
          link={{ stroke: "#3b82f6", strokeOpacity: 0.18 }}
          nodePadding={18}
          nodeWidth={10}
          margin={{ top: 8, right: 90, bottom: 8, left: 90 }}
        >
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.[0] ? (
                <div className="rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-xs shadow-lg">
                  <span className="text-text-secondary">{payload[0].name}</span>
                  <span className="ml-1.5 font-medium text-text-primary">
                    {metric === "cpu"
                      ? `${payload[0].value} cores`
                      : `${(Number(payload[0].value) / 4).toFixed(1)} GB`}
                  </span>
                </div>
              ) : null
            }
          />
        </Sankey>
      </ResponsiveContainer>
    </ExpandableCard>
  );
}
