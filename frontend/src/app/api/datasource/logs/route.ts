import { NextRequest, NextResponse } from "next/server";
import { logsRangeViaGateway } from "@/lib/datasource/queryGateway";
import { relativeRangeToSeconds } from "@/lib/datasource/timeRange";
import { getSessionToken } from "@/lib/serverFetch";

// Proxies a LogQL range query to query-gateway, which enforces the caller's
// RBAC scope (rewriting the stream selector's cluster/namespace matchers)
// before forwarding to Loki. Server-side only -- the gateway URL never
// reaches the browser.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // An empty stream selector is valid LogQL here -- query-gateway's
  // ScopeLogQL fills in the real cluster/namespace matchers itself, so the
  // caller never needs to (and can't, since they don't know their own
  // grants ahead of time).
  const query = req.nextUrl.searchParams.get("query") ?? "{}";
  const range = req.nextUrl.searchParams.get("range") ?? "now-15m";
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "300");
  const cluster = req.nextUrl.searchParams.get("cluster") ?? undefined;
  const end = req.nextUrl.searchParams.get("end");

  const rangeSeconds = relativeRangeToSeconds(range);
  const result = await logsRangeViaGateway(
    query,
    rangeSeconds,
    limit,
    getSessionToken(req),
    cluster,
    end ? Number(end) : undefined
  );
  return NextResponse.json(result);
}
