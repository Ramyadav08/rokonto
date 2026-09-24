"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { emptyDashboard, ObservexDashboard } from "@/dashboard/types";
import { Button } from "@/components/ui/Button";

export function NewDashboardModal({
  onCreate,
  onClose,
}: {
  onCreate: (dashboard: ObservexDashboard) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");

  function handleCreate() {
    if (!name.trim()) return;
    onCreate(emptyDashboard(name.trim()));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-text-primary">New dashboard</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-1.5 px-4 py-4">
          <label className="block text-xs font-medium text-text-secondary">Name</label>
          <input
            autoFocus
            className="w-full rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent-blue"
            placeholder="Production Overview"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!name.trim()} onClick={handleCreate}>
            Create dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
