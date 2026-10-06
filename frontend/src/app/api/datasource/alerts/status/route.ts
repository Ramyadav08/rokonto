import { NextRequest, NextResponse } from "next/server";
import { queryGatewayUrl, sessionCookieHeader, hostOf, getSessionToken } from "@/lib/serverFetch";

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
    if (!res.ok) {
      return NextResponse.json({ configured: false });
    }
    return NextResponse.json({ configured: true, host: hostOf(queryGatewayUrl()) });
  } catch {
    return NextResponse.json({ configured: false });
  }
}
