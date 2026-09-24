import { cn } from "@/lib/cn";

type Tone = "healthy" | "warning" | "critical" | "info" | "neutral";

const TONE_MAP: Record<string, Tone> = {
  healthy: "healthy",
  ok: "healthy",
  firing: "critical",
  critical: "critical",
  degraded: "warning",
  warning: "warning",
  pending: "warning",
  resolved: "neutral",
  error: "critical",
  info: "info",
  debug: "neutral",
};

const TONE_CLASSES: Record<Tone, string> = {
  healthy: "bg-status-healthy/15 text-status-healthy border-status-healthy/30",
  warning: "bg-status-warning/15 text-status-warning border-status-warning/30",
  critical: "bg-status-critical/15 text-status-critical border-status-critical/30",
  info: "bg-status-info/15 text-status-info border-status-info/30",
  neutral: "bg-text-muted/15 text-text-secondary border-border",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = TONE_MAP[status.toLowerCase()] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASSES[tone],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", {
        "bg-status-healthy": tone === "healthy",
        "bg-status-warning": tone === "warning",
        "bg-status-critical": tone === "critical",
        "bg-status-info": tone === "info",
        "bg-text-muted": tone === "neutral",
      })} />
      {status}
    </span>
  );
}

export function toneForStatus(status: string): Tone {
  return TONE_MAP[status.toLowerCase()] ?? "neutral";
}
