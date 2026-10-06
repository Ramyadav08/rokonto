import { NextRequest } from "next/server";

// The only cookie any Next.js route handler ever needs to look at or forward
// -- auth-service issues it, every backend service validates it.
export const SESSION_COOKIE = "observex_session";

export function getSessionToken(request: NextRequest): string | undefined {
  return request.cookies.get(SESSION_COOKIE)?.value;
}

/** Rebuilds just the session cookie for an outbound fetch to a backend
    service -- deliberately not the whole incoming Cookie header, so a
    backend service only ever sees the one cookie it actually checks. */
export function sessionCookieHeader(token: string): string {
  return `${SESSION_COOKIE}=${token}`;
}

// Separate cookie for the internal platform portal (Observex staff managing
// clients/tickets) -- a completely different auth system from the tenant
// session above, issued by platform-admin-service. Must match that service's
// auth.PlatformSessionCookie constant value exactly.
export const PLATFORM_SESSION_COOKIE = "observex_platform_session";

export function getPlatformSessionToken(request: NextRequest): string | undefined {
  return request.cookies.get(PLATFORM_SESSION_COOKIE)?.value;
}

export function platformSessionCookieHeader(token: string): string {
  return `${PLATFORM_SESSION_COOKIE}=${token}`;
}

export function hostOf(url: string): string | undefined {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

export function authServiceUrl(): string {
  return (process.env.AUTH_SERVICE_URL || "http://localhost:8081").replace(/\/+$/, "");
}

export function tenantServiceUrl(): string {
  return (process.env.TENANT_SERVICE_URL || "http://localhost:8082").replace(/\/+$/, "");
}

export function rbacServiceUrl(): string {
  return (process.env.RBAC_SERVICE_URL || "http://localhost:8083").replace(/\/+$/, "");
}

export function queryGatewayUrl(): string {
  return (process.env.QUERY_GATEWAY_URL || "http://localhost:8085").replace(/\/+$/, "");
}

export function blackboxServiceUrl(): string {
  return (process.env.BLACKBOX_SERVICE_URL || "http://localhost:8088").replace(/\/+$/, "");
}

export function platformAdminServiceUrl(): string {
  return (process.env.PLATFORM_ADMIN_SERVICE_URL || "http://localhost:8086").replace(/\/+$/, "");
}

export function supportServiceUrl(): string {
  return (process.env.SUPPORT_SERVICE_URL || "http://localhost:8087").replace(/\/+$/, "");
}
