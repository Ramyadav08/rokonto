import { NextRequest, NextResponse } from "next/server";
import { getPlatformSessionToken, platformAdminServiceUrl, platformSessionCookieHeader } from "@/lib/serverFetch";

// Passthrough for the current platform-admin identity -- any non-200 from
// platform-admin-service passes straight through so usePlatformSession()
// treats it as "not signed in".
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = getPlatformSessionToken(req);
  if (!token) {
    return NextResponse.json({ error: "no session" }, { status: 401 });
  }

  try {
    const upstream = await fetch(`${platformAdminServiceUrl()}/me`, {
      headers: { Cookie: platformSessionCookieHeader(token) },
      cache: "no-store",
    });
    const payload = await upstream.json().catch(() => ({}));
    return NextResponse.json(payload, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "could not reach the platform admin service" }, { status: 502 });
  }
}
