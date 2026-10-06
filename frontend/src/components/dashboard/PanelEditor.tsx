"use client";

import { ReactNode, useState } from "react";
import { X } from "lucide-react";
import { ObservexPanel, PanelType } from "@/dashboard/types";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";

const PANEL_TYPES: { label: string; value: PanelType }[] = [
  { label: "Stat", value: "stat" },
  { label: "Time series", value: "timeseries" },
  { label: "Gauge", value: "gauge" },
  { label: "Bar gauge", value: "bargauge" },
  { label: "Bar chart", value: "barchart" },
  { label: "Table", value: "table" },
  { label: "Logs", value: "logs" },
  { label: "Text", value: "text" },
];

const UNIT_OPTIONS = [
  { label: "None", value: "none" },
  { label: "Percent (0-100)", value: "percent" },
  { label: "Percent (0-1)", value: "percentunit" },
  { label: "Bytes", value: "bytes" },
  { label: "Bits/sec", value: "binbps" },
  { label: "Seconds", value: "s" },
  { label: "Milliseconds", value: "ms" },
];

const inputClass =
  "w-full rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent-blue";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-text-secondary">{label}</span>
      {children}
    </label>
  );
}

interface PanelEditorProps {
  panel: ObservexPanel;
  onSave: (panel: ObservexPanel) => void;
  onClose: () => void;
}

export function PanelEditor({ panel, onSave, onClose }: PanelEditorProps) {
  const [draft, setDraft] = useState<ObservexPanel>(panel);

  function update<K extends keyof ObservexPanel>(key: K, value: ObservexPanel[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-text-primary">Edit panel</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <Field label="Title">
            <input
              className={inputClass}
              value={draft.title}
              onChange={(e) => update("title", e.target.value)}
            />
          </Field>

          <Field label="Description">
            <input
              className={inputClass}
              value={draft.description ?? ""}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Optional"
            />
          </Field>

          <Field label="Visualization">
            <Select
              className="w-full"
              options={PANEL_TYPES}
              value={draft.type}
              onChange={(e) => update("type", e.target.value as PanelType)}
            />
          </Field>

          <Field label="Query / expression">
            <input
              className={cn(inputClass, "font-mono")}
              value={draft.targets[0]?.expr ?? ""}
              placeholder="e.g. sum(rate(http_requests_total[5m]))"
              onChange={(e) =>
                update("targets", [{ ...(draft.targets[0] ?? { refId: "A" }), expr: e.target.value }])
              }
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Unit">
              <Select
                className="w-full"
                options={UNIT_OPTIONS}
                value={draft.fieldConfig.unit ?? "none"}
                onChange={(e) => update("fieldConfig", { ...draft.fieldConfig, unit: e.target.value })}
              />
            </Field>
            <Field label="Decimals">
              <input
                type="number"
                min={0}
                max={4}
                className={inputClass}
                value={draft.fieldConfig.decimals ?? 1}
                onChange={(e) =>
                  update("fieldConfig", { ...draft.fieldConfig, decimals: Number(e.target.value) })
                }
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Min">
              <input
                type="number"
                className={inputClass}
                value={draft.fieldConfig.min ?? ""}
                onChange={(e) =>
                  update("fieldConfig", {
                    ...draft.fieldConfig,
                    min: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="Max">
              <input
                type="number"
                className={inputClass}
                value={draft.fieldConfig.max ?? ""}
                onChange={(e) =>
                  update("fieldConfig", {
                    ...draft.fieldConfig,
                    max: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
            </Field>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onSave(draft)}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
