import { NextRequest, NextResponse } from "next/server";
import { queryGatewayUrl, sessionCookieHeader, hostOf, getSessionToken } from "@/lib/serverFetch";

// "Configured" now means "there's a query-gateway to talk to AND this
// request has a valid session" -- there's no more mock fallback, so an
// unauthenticated caller and a genuinely unreachable gateway look the same
// to the UI (both render as "not connected"), same as the task's own
// not-configured/not-signed-in framing.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = getSessionToken(req);
  if (!token) {
    return NextResponse.json({ configured: false });
  }

  try {
    const res = await fetch(`${queryGatewayUrl()}/clusters`, {
      headers: { Cookie: sessionCookieHeader(token) },
      cache: "no-store",
    });
    if (res.status === 401) {
      return NextResponse.json({ configured: false });
    }
    if (!res.ok) {
      return NextResponse.json({ configured: false });
    }
    return NextResponse.json({ configured: true, host: hostOf(queryGatewayUrl()) });
  } catch {
    return NextResponse.json({ configured: false });
  }
}
