import { ReactNode } from "react";

/** A small visible caption above a control -- e.g. above a dashboard
    variable's <Select>, so it's clear which real label/filter it is (a
    `title` attribute alone is only a hover tooltip, easy to miss and not
    how Grafana itself labels its own variable dropdowns). */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs text-text-muted">{label}</div>
      {children}
    </div>
  );
}
