"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  clusterCount: number;
  userCount: number;
}

type ListState = { status: "loading" } | { status: "error"; detail: string } | { status: "loaded"; tenants: Tenant[] };

export default function PlatformTenantsPage() {
  const [state, setState] = useState<ListState>({ status: "loading" });

  useEffect(() => {
    setState({ status: "loading" });
    fetch("/api/platform/tenants")
      .then(async (r) => {
        if (!r.ok) {
          const payload = await r.json().catch(() => ({}));
          throw new Error(payload.error ?? `Request failed (${r.status})`);
        }
        return r.json();
      })
      .then((tenants: Tenant[]) => setState({ status: "loaded", tenants }))
      .catch((err) => setState({ status: "error", detail: err instanceof Error ? err.message : "Request failed." }));
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Clients</CardTitle>
        </CardHeader>
        <CardBody className="!p-0">
          {state.status === "loading" ? (
            <div className="flex items-center gap-1.5 p-4 text-sm text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : state.status === "error" ? (
            <div className="flex items-center gap-1.5 p-4 text-sm text-status-critical">
              <AlertTriangle className="h-4 w-4" />
              {state.detail}
            </div>
          ) : state.tenants.length === 0 ? (
            <div className="p-4 text-sm text-text-muted">No clients yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-text-muted">
                  <th className="px-4 py-2 font-normal">Name</th>
                  <th className="px-4 py-2 font-normal">Slug</th>
                  <th className="px-4 py-2 font-normal">Clusters</th>
                  <th className="px-4 py-2 font-normal">Users</th>
                  <th className="px-4 py-2 font-normal">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {state.tenants.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-2">
                      <Link href={`/platform/tenants/${t.id}`} className="text-accent-blue hover:underline">
                        {t.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-text-secondary">{t.slug}</td>
                    <td className="px-4 py-2 text-text-secondary">{t.clusterCount}</td>
                    <td className="px-4 py-2 text-text-secondary">{t.userCount}</td>
                    <td className="px-4 py-2 text-text-secondary">{new Date(t.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
