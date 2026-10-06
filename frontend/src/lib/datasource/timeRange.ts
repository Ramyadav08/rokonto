const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

/** "now-15m" -> 900, "now-6h" -> 21600. Falls back to 1 hour for anything unrecognized. */
export function relativeRangeToSeconds(value: string): number {
  const match = value.match(/^now-(\d+)([smhd])$/);
  if (!match) return 3600;
  const [, amount, unit] = match;
  return Number(amount) * (UNIT_SECONDS[unit] ?? 3600);
}

/** A step (seconds) that gives roughly `targetPoints` samples across the range. */
export function stepForRange(rangeSeconds: number, targetPoints = 60): number {
  return Math.max(1, Math.round(rangeSeconds / targetPoints));
}
