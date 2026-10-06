import { ObservexPanel } from "@/dashboard/types";
import { HelpCircle } from "lucide-react";

export function UnsupportedPanel({ panel }: { panel: ObservexPanel }) {
  const originalType = (panel.options?.originalType as string | undefined) ?? panel.type;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center text-text-muted">
      <HelpCircle className="h-4 w-4" />
      <span className="text-xs">
        Panel type &ldquo;{originalType}&rdquo; isn&apos;t supported yet
      </span>
    </div>
  );
}
