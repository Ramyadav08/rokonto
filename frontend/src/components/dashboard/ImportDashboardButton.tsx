"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { mockData } from "@/lib/mockData";
import { ObservexDashboard } from "@/dashboard/types";

export function ImportDashboardButton({
  onImported,
}: {
  onImported: (dashboard: ObservexDashboard) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const dashboard = mockData.importDashboardJson(json);
      onImported(dashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import this file.");
    }
  }

  return (
    <div className="relative">
      <Button variant="secondary" onClick={() => inputRef.current?.click()}>
        <Upload className="h-3.5 w-3.5" />
        Import
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      {error && (
        <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-md border border-status-critical/40 bg-surface-raised px-2.5 py-1.5 text-xs text-status-critical shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}
