"use client";

import { useEffect, useState } from "react";

export interface SessionUser {
  id: string;
  tenantId: string;
  email: string;
  role: "admin" | "editor" | "viewer" | "developer";
}

export interface SessionState {
  user: SessionUser | null;
  loading: boolean;
}

/** Calls /api/auth/me once on mount. A non-200 (401 with no session, 502 if
    auth-service is unreachable, etc.) is treated as "no user" -- callers that
    need a hard redirect on that should check `!loading && !user` themselves,
    since middleware already handles the common case of an entirely missing
    cookie before a page even renders. */
export function useSession(): SessionState {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((u: SessionUser | null) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, loading };
}
