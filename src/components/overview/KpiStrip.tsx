import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { getKpiStrip } from "@/mock/overview";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

const TONE_TEXT: Record<string, string> = {
  healthy: "text-status-healthy",
  warning: "text-status-warning",
  critical: "text-status-critical",
  neutral: "text-text-secondary",
};

const TREND_ICON = { up: ArrowUp, down: ArrowDown, flat: Minus };

export function KpiStrip() {
  const tiles = getKpiStrip();

  return (
    <Card className="grid grid-cols-2 divide-y divide-border sm:grid-cols-4 sm:divide-y-0 sm:divide-x lg:grid-cols-7">
      {tiles.map((tile) => {
        const TrendIcon = TREND_ICON[tile.trend];
        return (
          <div key={tile.label} className="p-3.5">
            <div className="text-xs text-text-muted">{tile.label}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-text-primary">{tile.value}</div>
            <div className={cn("mt-1 flex items-center gap-1 text-xs", TONE_TEXT[tile.tone])}>
              <TrendIcon className="h-3 w-3" />
              {tile.delta}
            </div>
          </div>
        );
      })}
    </Card>
  );
}
