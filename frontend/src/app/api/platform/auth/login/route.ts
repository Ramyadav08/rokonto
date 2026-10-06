import { NextRequest, NextResponse } from "next/server";
import { platformAdminServiceUrl } from "@/lib/serverFetch";

// Mirrors /api/auth/login exactly, against platform-admin-service instead --
// relays Set-Cookie byte-for-byte so this route can't drift from whatever
// cookie attributes platform-admin-service actually sets.
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
    upstream = await fetch(`${platformAdminServiceUrl()}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "could not reach the platform admin service" }, { status: 502 });
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
