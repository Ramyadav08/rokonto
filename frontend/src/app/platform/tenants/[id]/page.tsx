"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";

interface TenantCluster {
  id: string;
  name: string;
  env: string;
  lastSeenAt: string | null;
  createdAt: string;
}

interface TenantUser {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  clusters: TenantCluster[];
  users: TenantUser[];
}

type DetailState = { status: "loading" } | { status: "error"; detail: string } | { status: "loaded"; tenant: TenantDetail };

export default function PlatformTenantDetailPage() {
  const params = useParams<{ id: string }>();
  const [state, setState] = useState<DetailState>({ status: "loading" });

  useEffect(() => {
    setState({ status: "loading" });
    fetch(`/api/platform/tenants/${params.id}`)
      .then(async (r) => {
        if (!r.ok) {
          const payload = await r.json().catch(() => ({}));
          throw new Error(payload.error ?? `Request failed (${r.status})`);
        }
        return r.json();
      })
      .then((tenant: TenantDetail) => setState({ status: "loaded", tenant }))
      .catch((err) => setState({ status: "error", detail: err instanceof Error ? err.message : "Request failed." }));
  }, [params.id]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <Link href="/platform/tenants" className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to clients
      </Link>

      {state.status === "loading" ? (
        <div className="flex items-center gap-1.5 p-4 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : state.status === "error" ? (
        <div className="flex items-center gap-1.5 rounded-md border border-status-critical/30 bg-status-critical/10 p-4 text-sm text-status-critical">
          <AlertTriangle className="h-4 w-4" />
          {state.detail}
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{state.tenant.name}</CardTitle>
            </CardHeader>
            <CardBody className="space-y-1 text-sm text-text-secondary">
              <div>Slug: {state.tenant.slug}</div>
              <div>Created: {new Date(state.tenant.createdAt).toLocaleString()}</div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Clusters</CardTitle>
            </CardHeader>
            <CardBody className="!p-0">
              {state.tenant.clusters.length === 0 ? (
                <div className="p-4 text-sm text-text-muted">No clusters yet.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-text-muted">
                      <th className="px-4 py-2 font-normal">Name</th>
                      <th className="px-4 py-2 font-normal">Env</th>
                      <th className="px-4 py-2 font-normal">Last seen</th>
                      <th className="px-4 py-2 font-normal">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {state.tenant.clusters.map((c) => (
                      <tr key={c.id}>
                        <td className="px-4 py-2 text-text-primary">{c.name}</td>
                        <td className="px-4 py-2 text-text-secondary">{c.env}</td>
                        <td className="px-4 py-2 text-text-secondary">
                          {c.lastSeenAt ? new Date(c.lastSeenAt).toLocaleString() : "never"}
                        </td>
                        <td className="px-4 py-2 text-text-secondary">{new Date(c.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
            </CardHeader>
            <CardBody className="!p-0">
              {state.tenant.users.length === 0 ? (
                <div className="p-4 text-sm text-text-muted">No users yet.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-text-muted">
                      <th className="px-4 py-2 font-normal">Email</th>
                      <th className="px-4 py-2 font-normal">Role</th>
                      <th className="px-4 py-2 font-normal">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {state.tenant.users.map((u) => (
                      <tr key={u.id}>
                        <td className="px-4 py-2 text-text-primary">{u.email}</td>
                        <td className="px-4 py-2 text-text-secondary">{u.role}</td>
                        <td className="px-4 py-2 text-text-secondary">{new Date(u.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
