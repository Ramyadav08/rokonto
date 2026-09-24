/** "YYYY-MM" for the given date, in UTC. */
export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The last `months` calendar months including the current one, oldest first, as "YYYY-MM" keys. */
export function lastMonthKeys(months: number): string[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    keys.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  }
  return keys;
}

export function monthToDateRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  // Several providers' APIs require End strictly after Start; on the 1st
  // of the month that's not true yet, so fall back to a 1-day window.
  const end = now.getUTCDate() > 1 ? now : new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

/** Start of `months` calendar months ago through today, as YYYY-MM-DD. */
export function lastMonthsRange(months: number): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  return { start: start.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) };
}
