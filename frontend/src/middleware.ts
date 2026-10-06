import { NextRequest, NextResponse } from "next/server";

// Presence-only check: a request with no observex_session cookie at all
// never reaches a page, full stop. This deliberately does NOT verify the
// cookie's JWT (cheap, no backend round-trip here) -- an expired/invalid but
// still-present cookie is caught later, server-side, by whichever backend
// call the page/route makes (auth-service, query-gateway, etc. all 401 on a
// bad token), and every one of those call sites already renders that as an
// explicit "not signed in" state rather than assuming it's still valid.
//
// API routes are intentionally excluded from this gate: src/app/api/datasource
// and src/app/api/admin routes already treat a missing cookie as their own
// graceful "not signed in" response (not_configured / 401 passthrough) rather
// than a hard failure, which only works if the route itself still runs. A
// user only ever reaches those fetches from a page that passed this gate in
// the first place; this just covers the case of that same session's cookie
// expiring while a tab stays open.
export function middleware(req: NextRequest) {
  // The root path is the public marketing page -- an unauthenticated visitor
  // must actually see it instead of bouncing to /login, but someone who
  // already has a session is sent straight to their dashboard instead of the
  // pitch page.
  if (req.nextUrl.pathname === "/") {
    const hasSession = req.cookies.has("observex_session");
    if (hasSession) {
      return NextResponse.redirect(new URL("/overview", req.url));
    }
    return NextResponse.next();
  }

  // Platform portal (Observex staff, /platform/*) uses a completely separate
  // auth system/cookie from the tenant app below -- gate on that cookie and
  // return early so none of the tenant-session logic below ever runs for it.
  if (req.nextUrl.pathname.startsWith("/platform")) {
    if (req.nextUrl.pathname === "/platform/login") {
      return NextResponse.next();
    }
    const hasPlatformSession = req.cookies.has("observex_platform_session");
    if (!hasPlatformSession) {
      const loginUrl = new URL("/platform/login", req.url);
      loginUrl.searchParams.set("next", req.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  const hasSession = req.cookies.has("observex_session");
  if (!hasSession) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  // /charts/* (packaged Helm charts, e.g. the cluster-agent .tgz referenced
  // by the Connect Cluster page's install command) must be fetchable by
  // `helm install <url>` running on a client's own cluster -- it can never
  // carry our session cookie, so it's excluded here the same way /login and
  // /signup are, rather than redirected to a login page a non-browser client
  // can't follow.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|charts/|api/|login|signup).*)"],
};
