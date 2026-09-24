"use client";

import { useRouter } from "next/navigation";
import { mockData } from "@/lib/mockData";

/** Navigate to Explore > Logs, scoped to a specific instant (and optionally a series/service hint). */
export function useLogDrilldown() {
  const router = useRouter();
  return function goToLogs(timestamp: number, hint?: string) {
    const params = new URLSearchParams({ around: String(Math.round(timestamp)) });
    if (hint) params.set("q", hint);
    router.push(`/explore/logs?${params.toString()}`);
  };
}

/** The single most relevant synthesized log entry for a chart tooltip preview. */
export function getCorrelatedLog(timestamp: number, hint?: string) {
  return mockData.generateLogsAround(timestamp, hint, 3)[0];
}

/**
 * Recharts passes click events with `activeLabel` (the x-axis value, here
 * always our epoch-ms `time` field) and `activePayload` (the series under
 * the cursor). Pulls out (timestamp, seriesName) or null if the click
 * landed outside the plotted data.
 */
export function readChartClick(e: unknown): { timestamp: number; seriesName?: string } | null {
  const event = e as { activeLabel?: string | number; activePayload?: { name?: string }[] } | null;
  if (!event || event.activeLabel === undefined) return null;
  const timestamp = Number(event.activeLabel);
  if (Number.isNaN(timestamp)) return null;
  return { timestamp, seriesName: event.activePayload?.[0]?.name };
}
