"use client";

import { X } from "lucide-react";
import { ObservexPanel } from "@/dashboard/types";
import { PanelRenderer } from "@/dashboard/renderer/PanelRenderer";

export function PanelFullscreenModal({
  panel,
  onClose,
}: {
  panel: ObservexPanel;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 p-6">
      <div className="flex items-center justify-between pb-4">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">{panel.title}</h2>
          {panel.description && (
            <p className="mt-0.5 text-xs text-text-muted">{panel.description}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          aria-label="Close fullscreen panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 rounded-lg border border-border bg-surface p-4">
        <PanelRenderer panel={panel} />
      </div>
    </div>
  );
}
