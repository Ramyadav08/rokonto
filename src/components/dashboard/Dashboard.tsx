"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Plus, RefreshCw, Save } from "lucide-react";
import {
  emptyPanel,
  ObservexDashboard,
  ObservexPanel,
  REFRESH_PRESETS,
  TIME_RANGE_PRESETS,
} from "@/dashboard/types";
import { mockData } from "@/lib/mockData";
import { downloadJson } from "@/lib/download";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { DashboardGrid } from "./DashboardGrid";
import { PanelEditor } from "./PanelEditor";
import { PanelFullscreenModal } from "./PanelFullscreenModal";
import { ImportDashboardButton } from "./ImportDashboardButton";

function nextRowY(panels: ObservexPanel[]): number {
  return panels.reduce((max, p) => Math.max(max, p.gridPos.y + p.gridPos.h), 0);
}

export function Dashboard({ initial }: { initial: ObservexDashboard }) {
  const router = useRouter();
  const [dashboard, setDashboard] = useState(initial);
  const [timeRange, setTimeRange] = useState(initial.time.from);
  const [refresh, setRefresh] = useState(initial.refresh);
  const [tick, setTick] = useState(0);
  const [viewPanel, setViewPanel] = useState<ObservexPanel | null>(null);
  const [editPanel, setEditPanel] = useState<ObservexPanel | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const panels = dashboard.panels;

  function persist(next: ObservexDashboard) {
    setDashboard(next);
    mockData.saveDashboard(next);
  }

  function handleLayoutChange(updatedPanels: ObservexPanel[]) {
    persist({ ...dashboard, panels: updatedPanels });
  }

  function handleSave() {
    mockData.saveDashboard(dashboard);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  function handleExport() {
    const exported = mockData.exportDashboardJson(dashboard);
    downloadJson(`${dashboard.title.toLowerCase().replace(/\s+/g, "-")}.json`, exported);
  }

  function handleAddPanel() {
    const panel = emptyPanel("stat", { x: 0, y: nextRowY(panels), w: 8, h: 8 });
    setEditPanel(panel);
  }

  function handleDuplicate(panel: ObservexPanel) {
    const copy: ObservexPanel = {
      ...panel,
      id: Date.now(),
      title: `${panel.title} (copy)`,
      gridPos: { ...panel.gridPos, y: nextRowY(panels) },
    };
    persist({ ...dashboard, panels: [...panels, copy] });
  }

  function handleRemove(panel: ObservexPanel) {
    persist({ ...dashboard, panels: panels.filter((p) => p.id !== panel.id) });
  }

  function handlePanelSave(updated: ObservexPanel) {
    const exists = panels.some((p) => p.id === updated.id);
    const nextPanels = exists
      ? panels.map((p) => (p.id === updated.id ? updated : p))
      : [...panels, updated];
    persist({ ...dashboard, panels: nextPanels });
    setEditPanel(null);
  }

  function handleImported(imported: ObservexDashboard) {
    router.push(`/dashboards/${imported.id}`);
  }

  const timeLabel = useMemo(
    () => TIME_RANGE_PRESETS.find((t) => t.value === timeRange)?.label ?? "Custom",
    [timeRange]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-text-primary">{dashboard.title}</h1>
          {dashboard.description && (
            <p className="truncate text-xs text-text-muted">{dashboard.description}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {dashboard.variables.map((v) => (
            <Select
              key={v.name}
              options={v.options.map((o) => ({ label: o, value: o }))}
              value={v.current}
              onChange={(e) =>
                persist({
                  ...dashboard,
                  variables: dashboard.variables.map((variable) =>
                    variable.name === v.name ? { ...variable, current: e.target.value } : variable
                  ),
                })
              }
              title={v.label ?? v.name}
            />
          ))}

          <Select
            options={TIME_RANGE_PRESETS}
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
          />
          <Select
            options={REFRESH_PRESETS}
            value={refresh}
            onChange={(e) => setRefresh(e.target.value)}
          />
          <Button variant="ghost" onClick={() => setTick((t) => t + 1)} title="Refresh now">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="secondary" onClick={handleAddPanel}>
            <Plus className="h-3.5 w-3.5" />
            Add panel
          </Button>
          <Button variant="secondary" onClick={handleSave}>
            <Save className="h-3.5 w-3.5" />
            {savedFlash ? "Saved" : "Save"}
          </Button>
          <ImportDashboardButton onImported={handleImported} />
          <Button variant="secondary" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-text-muted">
        <span>{timeLabel}</span>
        <span>·</span>
        <span>{panels.filter((p) => p.type !== "row").length} panels</span>
        {refresh && (
          <>
            <span>·</span>
            <span>auto-refresh {refresh}</span>
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" key={tick}>
        <DashboardGrid
          panels={panels}
          editable
          onLayoutChange={handleLayoutChange}
          onView={setViewPanel}
          onEdit={setEditPanel}
          onDuplicate={handleDuplicate}
          onRemove={handleRemove}
        />
      </div>

      {viewPanel && <PanelFullscreenModal panel={viewPanel} onClose={() => setViewPanel(null)} />}
      {editPanel && (
        <PanelEditor panel={editPanel} onSave={handlePanelSave} onClose={() => setEditPanel(null)} />
      )}
    </div>
  );
}
