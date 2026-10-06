"use client";

import { useEffect, useState } from "react";

export interface PlatformAdmin {
  id: string;
  email: string;
}

export interface PlatformSessionState {
  admin: PlatformAdmin | null;
  loading: boolean;
}

/** Platform-portal equivalent of useSession() -- calls /api/platform/auth/me
    once on mount against platform-admin-service instead of auth-service. A
    non-200 is treated as "no admin", same reasoning as the tenant hook. */
export function usePlatformSession(): PlatformSessionState {
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/platform/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((a: PlatformAdmin | null) => {
        if (!cancelled) setAdmin(a);
      })
      .catch(() => {
        if (!cancelled) setAdmin(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { admin, loading };
}
