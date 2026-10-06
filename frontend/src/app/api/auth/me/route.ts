import { NextRequest, NextResponse } from "next/server";
import { authServiceUrl, getSessionToken, sessionCookieHeader } from "@/lib/serverFetch";

// Passthrough for the current session's identity -- 401/404 from auth-service
// pass straight through so useSession() (and anything else calling this) can
// treat any non-200 as "not signed in".
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = getSessionToken(req);
  if (!token) {
    return NextResponse.json({ error: "no session" }, { status: 401 });
  }

  try {
    const upstream = await fetch(`${authServiceUrl()}/me`, {
      headers: { Cookie: sessionCookieHeader(token) },
      cache: "no-store",
    });
    const payload = await upstream.json().catch(() => ({}));
    return NextResponse.json(payload, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "could not reach the auth service" }, { status: 502 });
  }
}
