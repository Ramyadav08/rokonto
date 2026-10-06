import { ObservexPanel } from "@/dashboard/types";

export function TextPanel({ panel }: { panel: ObservexPanel }) {
  const content =
    (panel.options?.content as string | undefined) ??
    panel.description ??
    "No content configured for this text panel.";

  return (
    <div className="h-full overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-text-secondary">
      {content}
    </div>
  );
}
