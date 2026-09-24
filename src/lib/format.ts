function round(value: number, decimals = 1): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function humanizeBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024)));
  return `${round(bytes / Math.pow(1024, i), decimals)} ${units[i]}`;
}

function humanizeBits(bitsPerSec: number, decimals = 1): string {
  const units = ["bps", "Kbps", "Mbps", "Gbps"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(Math.abs(bitsPerSec) || 1) / Math.log(1000)));
  return `${round(bitsPerSec / Math.pow(1000, i), decimals)} ${units[i]}`;
}

export function formatByUnit(value: number, unit?: string, decimals = 1): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  switch (unit) {
    case "percentunit":
      return `${round(value * 100, decimals)}%`;
    case "percent":
      return `${round(value, decimals)}%`;
    case "bytes":
      return humanizeBytes(value, decimals);
    case "binbps":
    case "bps":
      return humanizeBits(value, decimals);
    case "s":
      return value < 1 ? `${round(value * 1000, 0)}ms` : `${round(value, 2)}s`;
    case "ms":
      return `${round(value, 0)}ms`;
    case "none":
    default:
      return Intl.NumberFormat("en-US", { maximumFractionDigits: decimals }).format(round(value, decimals));
  }
}

export function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0");
}

export function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", { hour12: false });
}

export function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
