import { NextRequest, NextResponse } from "next/server";
import {
  getPlatformSessionToken,
  getSessionToken,
  platformSessionCookieHeader,
  sessionCookieHeader,
} from "@/lib/serverFetch";

/**
 * Every admin route below is a thin proxy: forward the session cookie,
 * relay tenant-service/rbac-service's own response and status code as-is.
 * Both of those services already enforce "admin role required" themselves
 * (403 on a non-admin caller) -- this proxy doesn't duplicate that check,
 * it just needs a session to forward at all.
 */
export async function proxyToBackend(req: NextRequest, baseUrl: string, path: string, init?: RequestInit) {
  const token = getSessionToken(req);
  if (!token) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  try {
    const upstream = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), Cookie: sessionCookieHeader(token) },
      cache: "no-store",
    });
    const payload = await upstream.json().catch(() => null);
    return NextResponse.json(payload, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "could not reach the backend service" }, { status: 502 });
  }
}

/**
 * Platform-portal equivalent of proxyToBackend above: same shape, but reads
 * and forwards the platform-admin session cookie (observex_platform_session)
 * instead of the tenant one, against platform-admin-service/support-service.
 */
export async function proxyToPlatformBackend(req: NextRequest, baseUrl: string, path: string, init?: RequestInit) {
  const token = getPlatformSessionToken(req);
  if (!token) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  try {
    const upstream = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), Cookie: platformSessionCookieHeader(token) },
      cache: "no-store",
    });
    const payload = await upstream.json().catch(() => null);
    return NextResponse.json(payload, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "could not reach the backend service" }, { status: 502 });
  }
}
