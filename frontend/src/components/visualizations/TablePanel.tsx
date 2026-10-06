"use client";

import { DashboardVariable, ObservexPanel } from "@/dashboard/types";
import { usePanelData, buildLiveTableRows } from "@/dashboard/usePanelData";
import { PanelStatusMessage, PanelNoDataMessage } from "./PanelStatusMessage";

export function TablePanel({
  panel,
  timeRange,
  variables,
}: {
  panel: ObservexPanel;
  timeRange: string;
  variables?: DashboardVariable[];
}) {
  const live = usePanelData(panel, timeRange, variables);
  if (live.status !== "live") {
    return <PanelStatusMessage status={live.status} detail={live.detail} />;
  }

  const rows = buildLiveTableRows(panel, live.series, live.seriesByTarget);
  if (rows.length === 0) {
    return <PanelNoDataMessage />;
  }
  const columns = panel.fieldConfig.columns ?? Object.keys(rows[0] ?? { Name: "", Value: "" });

  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 bg-surface">
          <tr>
            {columns.map((col, colIdx) => (
              <th
                key={`${col}-${colIdx}`}
                className="border-b border-border px-2 py-1.5 text-left font-medium text-text-muted"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-surface-hover">
              {columns.map((col, colIdx) => (
                <td
                  key={`${col}-${colIdx}`}
                  className={`border-b border-border/60 px-2 py-1.5 text-text-secondary ${
                    colIdx > 0 ? "text-right tabular-nums" : ""
                  }`}
                >
                  {row[col] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
