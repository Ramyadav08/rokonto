import { NextRequest, NextResponse } from "next/server";
import { authServiceUrl } from "@/lib/serverFetch";

// Forwards to auth-service's POST /login and relays its Set-Cookie header to
// the browser byte-for-byte -- this route never reconstructs the cookie
// itself, so it can't drift out of sync with auth-service's own attributes
// (httpOnly, sameSite, maxAge) if those ever change.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${authServiceUrl()}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "could not reach the auth service" }, { status: 502 });
  }

  const payload = await upstream.json().catch(() => ({}));
  const response = NextResponse.json(payload, { status: upstream.status });

  const setCookie =
    typeof upstream.headers.getSetCookie === "function"
      ? upstream.headers.getSetCookie()
      : upstream.headers.get("set-cookie")
        ? [upstream.headers.get("set-cookie") as string]
        : [];
  for (const cookie of setCookie) {
    response.headers.append("Set-Cookie", cookie);
  }

  return response;
}
