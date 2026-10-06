import { NextRequest, NextResponse } from "next/server";
import { queryRangeViaGateway } from "@/lib/datasource/queryGateway";
import { relativeRangeToSeconds, stepForRange } from "@/lib/datasource/timeRange";
import { getSessionToken } from "@/lib/serverFetch";

// Proxies a PromQL range query to query-gateway, which enforces the caller's
// RBAC scope before forwarding to Mimir. Server-side only -- the gateway URL
// never reaches the browser.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query");
  const range = req.nextUrl.searchParams.get("range") ?? "now-1h";
  const cluster = req.nextUrl.searchParams.get("cluster") ?? undefined;
  if (!query) {
    return NextResponse.json({ status: "error", detail: "Missing query parameter." }, { status: 400 });
  }

  const rangeSeconds = relativeRangeToSeconds(range);
  const step = stepForRange(rangeSeconds);
  const result = await queryRangeViaGateway(query, rangeSeconds, step, getSessionToken(req), cluster);
  return NextResponse.json(result);
}
