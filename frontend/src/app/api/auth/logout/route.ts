import { NextRequest, NextResponse } from "next/server";
import { authServiceUrl, getSessionToken, sessionCookieHeader } from "@/lib/serverFetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = getSessionToken(req);

  let upstream: Response | null = null;
  try {
    upstream = await fetch(`${authServiceUrl()}/logout`, {
      method: "POST",
      headers: token ? { Cookie: sessionCookieHeader(token) } : {},
      cache: "no-store",
    });
  } catch {
    // Even if auth-service is unreachable, clear the local cookie below so
    // the browser stops sending a session that may no longer be valid.
  }

  const response = NextResponse.json({ status: "ok" });
  const setCookie = upstream && typeof upstream.headers.getSetCookie === "function" ? upstream.headers.getSetCookie() : [];
  if (setCookie.length > 0) {
    for (const cookie of setCookie) response.headers.append("Set-Cookie", cookie);
  } else {
    // Fallback clear in case auth-service didn't respond -- same attributes
    // it uses so the browser actually drops the cookie.
    response.cookies.set("observex_session", "", { path: "/", httpOnly: true, maxAge: 0 });
  }
  return response;
}
