"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, Check, Copy, Loader2, X } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

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

export default function ClustersPage() {
  const [state, setState] = useState<ListState>({ status: "loading" });
  const [name, setName] = useState("");
  const [env, setEnv] = useState<"dev" | "stg" | "prod">("dev");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedCluster | null>(null);
  const [copied, setCopied] = useState(false);

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
      load();
    } catch {
      setFormError("Could not reach the server.");
    } finally {
      setCreating(false);
    }
  }

  async function copyToken() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.agentToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser -- the token is still
      // visible to select/copy manually, so this isn't a hard failure.
    }
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
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-xs text-text-primary">
                {created.agentToken}
              </code>
              <Button type="button" variant="secondary" onClick={copyToken}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-text-muted">
              Save this now and use it to configure the cluster-agent Helm chart -- {created.note}.
            </p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>New cluster</CardTitle>
        </CardHeader>
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
          </form>
          {formError && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-status-critical">
              <AlertTriangle className="h-3.5 w-3.5" />
              {formError}
            </div>
          )}
        </CardBody>
      </Card>

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
                  <th className="px-4 py-2 font-normal">Last seen</th>
                  <th className="px-4 py-2 font-normal">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {state.clusters.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 text-text-primary">{c.name}</td>
                    <td className="px-4 py-2 text-text-secondary">{c.env}</td>
                    <td className="px-4 py-2 text-text-secondary">{c.lastSeenAt ? new Date(c.lastSeenAt).toLocaleString() : "never"}</td>
                    <td className="px-4 py-2 text-text-secondary">{new Date(c.createdAt).toLocaleString()}</td>
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
