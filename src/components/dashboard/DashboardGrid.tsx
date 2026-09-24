"use client";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import GridLayout, { WidthProvider, type Layout } from "react-grid-layout/legacy";
import { useMemo } from "react";
import { ObservexPanel } from "@/dashboard/types";
import { DashboardPanel } from "./DashboardPanel";

const ReactGridLayout = WidthProvider(GridLayout);

interface DashboardGridProps {
  panels: ObservexPanel[];
  editable: boolean;
  onLayoutChange: (panels: ObservexPanel[]) => void;
  onView: (panel: ObservexPanel) => void;
  onEdit: (panel: ObservexPanel) => void;
  onDuplicate: (panel: ObservexPanel) => void;
  onRemove: (panel: ObservexPanel) => void;
}

export function DashboardGrid({
  panels,
  editable,
  onLayoutChange,
  onView,
  onEdit,
  onDuplicate,
  onRemove,
}: DashboardGridProps) {
  const layout: Layout = useMemo(
    () =>
      panels.map((p) => ({
        i: String(p.id),
        x: p.gridPos.x,
        y: p.gridPos.y,
        w: p.gridPos.w,
        h: p.gridPos.h,
        static: p.type === "row" || !editable,
      })),
    [panels, editable]
  );

  function handleLayoutChange(newLayout: Layout) {
    if (!editable) return;
    const updated = panels.map((p) => {
      const item = newLayout.find((l) => l.i === String(p.id));
      if (!item) return p;
      return { ...p, gridPos: { x: item.x, y: item.y, w: item.w, h: item.h } };
    });
    onLayoutChange(updated);
  }

  if (panels.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-1 text-text-muted">
        <span className="text-sm">This dashboard has no panels yet.</span>
        <span className="text-xs">Use &ldquo;Add panel&rdquo; to get started.</span>
      </div>
    );
  }

  return (
    <ReactGridLayout
      className="px-3 pb-8"
      layout={layout}
      cols={24}
      rowHeight={26}
      margin={[8, 8]}
      containerPadding={[4, 12]}
      draggableHandle=".panel-drag-handle"
      isDraggable={editable}
      isResizable={editable}
      // Deliberately NOT onLayoutChange: react-grid-layout fires that on
      // every layout computation, including the initial mount (its own
      // compaction pass counts as a "change"). Wiring persistence to it
      // means just opening a dashboard silently writes a snapshot to
      // localStorage, permanently shadowing the source JSON file from then
      // on. onDragStop/onResizeStop only fire from an actual user gesture.
      onDragStop={(newLayout) => handleLayoutChange(newLayout)}
      onResizeStop={(newLayout) => handleLayoutChange(newLayout)}
      compactType="vertical"
    >
      {panels.map((panel) =>
        panel.type === "row" ? (
          <div
            key={panel.id}
            className="flex items-center border-b border-border-subtle px-1 text-xs font-semibold uppercase tracking-wide text-text-muted"
          >
            {panel.title}
          </div>
        ) : (
          <div key={panel.id}>
            <DashboardPanel
              panel={panel}
              editable={editable}
              onView={() => onView(panel)}
              onEdit={() => onEdit(panel)}
              onDuplicate={() => onDuplicate(panel)}
              onRemove={() => onRemove(panel)}
            />
          </div>
        )
      )}
    </ReactGridLayout>
  );
}
