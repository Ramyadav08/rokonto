"use client";

import { GripVertical } from "lucide-react";
import { ObservexPanel } from "@/dashboard/types";
import { PanelMenu } from "./PanelMenu";

interface PanelHeaderProps {
  panel: ObservexPanel;
  editable: boolean;
  compact?: boolean;
  onView: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

export function PanelHeader({ panel, editable, compact, onView, onEdit, onDuplicate, onRemove }: PanelHeaderProps) {
  return (
    <div
      className={`flex items-center justify-between gap-2 border-b border-border px-2.5 ${
        compact ? "py-0.5" : "py-1.5"
      }`}
    >
      {/* Drag handle is a plain (non-clickable) region so dragging never
          also fires the panel's click-to-view action. */}
      <div
        className="panel-drag-handle flex min-w-0 flex-1 items-center gap-1"
        title={panel.description}
      >
        {editable && !compact && (
          <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-text-muted" />
        )}
        <span className="truncate text-xs font-medium text-text-primary">{panel.title}</span>
      </div>
      <PanelMenu editable={editable} onView={onView} onEdit={onEdit} onDuplicate={onDuplicate} onRemove={onRemove} />
    </div>
  );
}
