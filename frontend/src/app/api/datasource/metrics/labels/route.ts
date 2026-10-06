import { NextRequest, NextResponse } from "next/server";
import { labelValuesViaGateway } from "@/lib/datasource/queryGateway";
import { getSessionToken } from "@/lib/serverFetch";

// Proxies a label-values lookup to query-gateway (scoped to the caller's
// granted clusters server-side). Used to populate the Metrics Explorer's
// dropdowns with real label values -- no mock fallback list.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const label = req.nextUrl.searchParams.get("label");
  const metric = req.nextUrl.searchParams.get("metric") ?? undefined;
  const cluster = req.nextUrl.searchParams.get("cluster") ?? undefined;
  if (!label) {
    return NextResponse.json({ values: [] }, { status: 400 });
  }

  const values = await labelValuesViaGateway(label, metric, getSessionToken(req), cluster);
  return NextResponse.json({ values });
}
