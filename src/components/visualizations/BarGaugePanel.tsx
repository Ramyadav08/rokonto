"use client";

import { ObservexPanel } from "@/dashboard/types";
import { seededValue } from "@/mock/generator";
import { formatByUnit } from "@/lib/format";
import { colorForValue } from "@/lib/thresholds";

export function BarGaugePanel({ panel }: { panel: ObservexPanel }) {
  const min = panel.fieldConfig.min ?? 0;
  const max = panel.fieldConfig.max ?? 1;
  const targets = panel.targets.length > 0 ? panel.targets : [{ refId: "A", expr: "" }];

  return (
    // justify-start (not center): a centered flex container clips content
    // above the fold when it overflows, and scrolling can't reach it --
    // real dashboards often pack more bars than fit a short panel.
    <div className="flex h-full flex-col justify-start gap-2.5 overflow-y-auto py-1">
      {targets.map((target) => {
        const label = target.legend || target.refId;
        const value = seededValue(`bargauge-${panel.id}-${label}`, panel.fieldConfig);
        const color = colorForValue(value, panel.fieldConfig.thresholds, max, panel.fieldConfig.unit);
        const percent = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

        return (
          <div key={target.refId} className="px-1">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="truncate text-text-secondary">{label}</span>
              <span className="font-medium tabular-nums" style={{ color }}>
                {formatByUnit(value, panel.fieldConfig.unit, panel.fieldConfig.decimals ?? 1)}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
              <div
                className="h-full rounded-full transition-[width]"
                style={{ width: `${percent}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
