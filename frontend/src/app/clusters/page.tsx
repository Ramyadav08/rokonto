"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, Check, Copy, Loader2, Plus, Trash2, X } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useSession } from "@/lib/useSession";

interface Cluster {
  id: string;
  name: string;
  env: "dev" | "stg" | "prod";
  lastSeenAt: string | null;
  createdAt: string;
}

interface CreatedCluster extends Cluster {
  agentToken: string;
  note: string;
}

type ListState = { status: "loading" } | { status: "error"; detail: string } | { status: "loaded"; clusters: Cluster[] };

type Health = "healthy" | "stale" | "never";

const HEALTHY_WINDOW_MS = 5 * 60 * 1000;

/** A cluster's connectivity is derived purely from `lastSeenAt`, which the
    backend already returns -- never fabricated, and recomputed on every
    render so the dot ages out of "healthy" on its own without a refetch. */
function deriveHealth(lastSeenAt: string | null): Health {
  if (!lastSeenAt) return "never";
  const seenMs = Date.parse(lastSeenAt);
  if (Number.isNaN(seenMs)) return "never";
  return Date.now() - seenMs <= HEALTHY_WINDOW_MS ? "healthy" : "stale";
}

const HEALTH_LABEL: Record<Health, string> = {
  healthy: "Healthy",
  stale: "Stale",
  never: "Never connected",
};

const HEALTH_DOT: Record<Health, string> = {
  healthy: "bg-status-healthy",
  stale: "bg-status-warning",
  never: "bg-status-unknown",
};

const INGEST_GATEWAY_URL = process.env.NEXT_PUBLIC_INGEST_GATEWAY_URL || "";

// The chart's own alloy dependency is vendored in at package time (`helm
// dependency build` + `helm package`, done by us, not the client) and the
// resulting .tgz is published as a static file alongside this app -- so a
// real client needs nothing but `helm install` pointed at that one URL, no
// access to our source repo or any `helm repo add` of their own. Bump this
// version string whenever deploy/cluster-agent/Chart.yaml's version changes
// and a freshly packaged .tgz is published to public/charts/.
const CLUSTER_AGENT_CHART_VERSION = "0.1.0";

function helmInstallCommand(clusterName: string, agentToken: string): string {
  const ingestUrl = INGEST_GATEWAY_URL || "<your-ingest-gateway-url>";
  const chartUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/charts/observex-cluster-agent-${CLUSTER_AGENT_CHART_VERSION}.tgz`
      : `<observex-url>/charts/observex-cluster-agent-${CLUSTER_AGENT_CHART_VERSION}.tgz`;
  return [
    `helm upgrade --install observex-agent ${chartUrl} \\`,
    "  --namespace observex-agent --create-namespace \\",
    `  --set observex.ingestURL=${ingestUrl} \\`,
    `  --set observex.agentToken=${agentToken} \\`,
    `  --set observex.clusterName=${clusterName}`,
  ].join("\n");
}

/** navigator.clipboard is only available in a "secure context" (HTTPS, or
    localhost) -- on a plain-HTTP deployment (e.g. an IP address during
    testing) it's either undefined or throws, and silently doing nothing is
    what looked like a broken Copy button. document.execCommand("copy") via a
    throwaway textarea still works in that case, so it's the fallback here
    rather than the only path -- it's deprecated but every evergreen browser
    still implements it, and the alternative is no working copy button at all
    on non-HTTPS deployments. */
async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the execCommand fallback below
    }
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export default function ClustersPage() {
  const { user } = useSession();
  const isAdmin = user?.role === "admin";

  const [state, setState] = useState<ListState>({ status: "loading" });
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [env, setEnv] = useState<"dev" | "stg" | "prod">("dev");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedCluster | null>(null);
  const [copied, setCopied] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    setState({ status: "loading" });
    fetch("/api/admin/clusters")
      .then(async (r) => {
        if (!r.ok) {
          const payload = await r.json().catch(() => ({}));
          throw new Error(payload.error ?? `Request failed (${r.status})`);
        }
        return r.json();
      })
      .then((clusters: Cluster[]) => setState({ status: "loaded", clusters }))
      .catch((err) => setState({ status: "error", detail: err instanceof Error ? err.message : "Request failed." }));
  }

  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setFormError(null);
    try {
      const res = await fetch("/api/admin/clusters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, env }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(payload.error ?? `Could not create cluster (${res.status}).`);
        return;
      }
      setCreated(payload as CreatedCluster);
      setName("");
      setShowForm(false);
      load();
    } catch {
      setFormError("Could not reach the server.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/admin/clusters/${id}`, { method: "DELETE" });
      load();
    } finally {
      setDeletingId(null);
    }
  }

  async function copyToken() {
    if (!created) return;
    const ok = await copyText(helmInstallCommand(created.name, created.agentToken));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    // If both copy paths fail (ok === false), the command is still visible
    // to select/copy manually, so this isn't a hard failure.
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      {created && (
        <Card className="border-status-warning/40 bg-status-warning/5">
          <CardBody className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 text-sm font-medium text-status-warning">
                <AlertTriangle className="h-4 w-4" />
                Agent token for &ldquo;{created.name}&rdquo; -- this will not be shown again
              </div>
              <button onClick={() => setCreated(null)} className="text-text-muted hover:text-text-primary" aria-label="Dismiss">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-text-muted">
              Save this now -- {created.note}. Run this to install the cluster-agent:
            </p>
            <div className="relative">
              <pre className="overflow-x-auto rounded-md border border-border bg-surface-raised p-3 text-xs text-text-primary">
                <code>{helmInstallCommand(created.name, created.agentToken)}</code>
              </pre>
              <Button type="button" variant="secondary" onClick={copyToken} className="absolute right-2 top-2">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            {!INGEST_GATEWAY_URL && (
              <p className="text-xs text-status-warning">
                Set NEXT_PUBLIC_INGEST_GATEWAY_URL to have the ingest URL filled in automatically.
              </p>
            )}
            <p className="text-xs text-text-muted">
              Once deployed, this cluster will show healthy above within a few minutes once its agent starts reporting.
            </p>
          </CardBody>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Connect new cluster</CardTitle>
            {!showForm && (
              <Button type="button" variant="primary" onClick={() => setShowForm(true)}>
                <Plus className="h-3.5 w-3.5" />
                Connect new cluster
              </Button>
            )}
          </CardHeader>
          {showForm && (
            <CardBody>
              <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs text-text-muted" htmlFor="cluster-name">
                    Name
                  </label>
                  <input
                    id="cluster-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="prod-us-east-1"
                    className="rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent-blue"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-muted" htmlFor="cluster-env">
                    Environment
                  </label>
                  <Select
                    id="cluster-env"
                    options={[
                      { label: "dev", value: "dev" },
                      { label: "stg", value: "stg" },
                      { label: "prod", value: "prod" },
                    ]}
                    value={env}
                    onChange={(e) => setEnv(e.target.value as "dev" | "stg" | "prod")}
                  />
                </div>
                <Button type="submit" variant="primary" disabled={creating}>
                  {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Create cluster
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </form>
              {formError && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-status-critical">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {formError}
                </div>
              )}
            </CardBody>
          )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Clusters</CardTitle>
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
          ) : state.clusters.length === 0 ? (
            <div className="p-4 text-sm text-text-muted">No clusters yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-text-muted">
                  <th className="px-4 py-2 font-normal">Name</th>
                  <th className="px-4 py-2 font-normal">Env</th>
                  <th className="px-4 py-2 font-normal">Status</th>
                  <th className="px-4 py-2 font-normal">Created</th>
                  {isAdmin && <th className="px-4 py-2 font-normal" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {state.clusters.map((c) => {
                  const health = deriveHealth(c.lastSeenAt);
                  const tooltip = c.lastSeenAt ? new Date(c.lastSeenAt).toLocaleString() : "Never connected";
                  return (
                    <tr key={c.id}>
                      <td className="px-4 py-2 text-text-primary">{c.name}</td>
                      <td className="px-4 py-2 text-text-secondary">{c.env}</td>
                      <td className="px-4 py-2 text-text-secondary">
                        <span className="flex items-center gap-1.5" title={tooltip}>
                          <span className={`h-1.5 w-1.5 rounded-full ${HEALTH_DOT[health]}`} />
                          {HEALTH_LABEL[health]}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-text-secondary">{new Date(c.createdAt).toLocaleString()}</td>
                      {isAdmin && (
                        <td className="px-4 py-2 text-right">
                          <Button
                            variant="danger"
                            onClick={() => handleDelete(c.id)}
                            disabled={deletingId === c.id}
                            aria-label={`Delete ${c.name}`}
                          >
                            {deletingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
