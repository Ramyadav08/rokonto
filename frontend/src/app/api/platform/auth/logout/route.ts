import { NextRequest, NextResponse } from "next/server";
import { getPlatformSessionToken, platformAdminServiceUrl, platformSessionCookieHeader } from "@/lib/serverFetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = getPlatformSessionToken(req);

  let upstream: Response | null = null;
  try {
    upstream = await fetch(`${platformAdminServiceUrl()}/logout`, {
      method: "POST",
      headers: token ? { Cookie: platformSessionCookieHeader(token) } : {},
      cache: "no-store",
    });
  } catch {
    // Even if platform-admin-service is unreachable, clear the local cookie
    // below so the browser stops sending a session that may no longer be valid.
  }

  const response = NextResponse.json({ status: "ok" });
  const setCookie = upstream && typeof upstream.headers.getSetCookie === "function" ? upstream.headers.getSetCookie() : [];
  if (setCookie.length > 0) {
    for (const cookie of setCookie) response.headers.append("Set-Cookie", cookie);
  } else {
    response.cookies.set("observex_platform_session", "", { path: "/", httpOnly: true, maxAge: 0 });
  }
  return response;
}
