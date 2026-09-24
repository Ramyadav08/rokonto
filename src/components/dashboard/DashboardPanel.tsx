"use client";

import { ObservexPanel } from "@/dashboard/types";
import { PanelRenderer } from "@/dashboard/renderer/PanelRenderer";
import { PanelHeader } from "./PanelHeader";

interface DashboardPanelProps {
  panel: ObservexPanel;
  editable: boolean;
  onView: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

export function DashboardPanel({ panel, editable, onView, onEdit, onDuplicate, onRemove }: DashboardPanelProps) {
  // Grafana dashboards routinely pack very short tiles (h <= 3 grid units,
  // ~60px). The default header/body padding alone would eat that whole
  // budget and clip the panel's content, so shrink both for tiny panels.
  const compact = panel.gridPos.h <= 3;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-panel">
      <PanelHeader
        panel={panel}
        editable={editable}
        compact={compact}
        onView={onView}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onRemove={onRemove}
      />
      <div
        role="button"
        tabIndex={0}
        onClick={onView}
        onKeyDown={(e) => {
          if (e.key === "Enter") onView();
        }}
        className={`min-h-0 flex-1 cursor-pointer text-left ${compact ? "p-0.5" : "p-2"}`}
        aria-label={`View ${panel.title} fullscreen`}
      >
        <PanelRenderer panel={panel} />
      </div>
    </div>
  );
}
