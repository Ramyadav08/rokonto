"use client";

import { ObservexPanel } from "@/dashboard/types";
import { generateTableRows } from "@/mock/generator";

export function TablePanel({ panel }: { panel: ObservexPanel }) {
  const rows = generateTableRows(panel);
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
