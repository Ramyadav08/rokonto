import { NextRequest, NextResponse } from "next/server";
import { queryGatewayUrl, sessionCookieHeader, getSessionToken } from "@/lib/serverFetch";

// Proxies query-gateway's GET /clusters -- RBAC-filtered to exactly what THIS
// caller can query, which is what the global cluster picker must populate
// from. Deliberately NOT tenant-service's /clusters (the admin management
// list behind src/app/api/admin/clusters): that one lists every cluster in
// the tenant regardless of this user's own grants.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = getSessionToken(req);
  if (!token) {
    return NextResponse.json([]);
  }
  try {
    const res = await fetch(`${queryGatewayUrl()}/clusters`, {
      headers: { Cookie: sessionCookieHeader(token) },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json([]);
    }
    const payload = await res.json().catch(() => []);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json([]);
  }
}
