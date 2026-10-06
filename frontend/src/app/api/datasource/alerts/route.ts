import { NextRequest, NextResponse } from "next/server";
import { fetchAlertsViaGateway } from "@/lib/datasource/queryGateway";
import { getSessionToken } from "@/lib/serverFetch";

// Proxies query-gateway's /alerts route (Mimir's built-in Alertmanager,
// filtered to the caller's clusters/namespaces). Server-side only.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cluster = req.nextUrl.searchParams.get("cluster") ?? undefined;
  const result = await fetchAlertsViaGateway(getSessionToken(req), cluster);
  return NextResponse.json(result);
}
