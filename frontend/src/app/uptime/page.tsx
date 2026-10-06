"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { DatasourceQueryResult, DatasourceStatus } from "@/lib/datasource/types";

interface Check {
  id: string;
  name: string;
  url: string;
  intervalSeconds: number;
}

type ListState = { status: "loading" } | { status: "error"; detail: string } | { status: "loaded"; checks: Check[] };

export default function UptimePage() {
  const [state, setState] = useState<ListState>({ status: "loading" });
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [intervalSeconds, setIntervalSeconds] = useState(60);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    setState({ status: "loading" });
    fetch("/api/blackbox/checks")
      .then(async (r) => {
        if (!r.ok) {
          const payload = await r.json().catch(() => ({}));
          throw new Error(payload.error ?? `Request failed (${r.status})`);
        }
        return r.json();
      })
      .then((checks: Check[]) => setState({ status: "loaded", checks }))
      .catch((err) => setState({ status: "error", detail: err instanceof Error ? err.message : "Request failed." }));
  }

  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setFormError(null);
    try {
      const res = await fetch("/api/blackbox/checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url, intervalSeconds }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(payload.error ?? `Could not create check (${res.status}).`);
        return;
      }
      setName("");
      setUrl("");
      setIntervalSeconds(60);
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
      await fetch(`/api/blackbox/checks/${id}`, { method: "DELETE" });
      load();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>New check</CardTitle>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-text-muted" htmlFor="check-name">
                Name
              </label>
              <input
                id="check-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="homepage"
                className="rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent-blue"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted" htmlFor="check-url">
                URL
              </label>
              <input
                id="check-url"
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-64 rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent-blue"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted" htmlFor="check-interval">
                Interval (seconds)
              </label>
              <input
                id="check-interval"
                type="number"
                min={10}
                required
                value={intervalSeconds}
                onChange={(e) => setIntervalSeconds(Number(e.target.value))}
                className="w-28 rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent-blue"
              />
            </div>
            <Button type="submit" variant="primary" disabled={creating}>
              {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Add check
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
          <CardTitle>Checks</CardTitle>
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
          ) : state.checks.length === 0 ? (
            <div className="p-4 text-sm text-text-muted">No checks yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-text-muted">
                  <th className="px-4 py-2 font-normal">Name</th>
                  <th className="px-4 py-2 font-normal">URL</th>
                  <th className="px-4 py-2 font-normal">Interval</th>
                  <th className="px-4 py-2 font-normal">Status</th>
                  <th className="px-4 py-2 font-normal" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {state.checks.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 text-text-primary">{c.name}</td>
                    <td className="max-w-[220px] truncate px-4 py-2 text-text-secondary" title={c.url}>
                      {c.url}
                    </td>
                    <td className="px-4 py-2 text-text-secondary">{c.intervalSeconds}s</td>
                    <td className="px-4 py-2">
                      <UptimeStatus checkName={c.name} />
                    </td>
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

type ProbeState = "loading" | "no_data" | "up" | "down";

/** Reads `probe_success{check_name="<name>"}` through the same
    /api/datasource/metrics route Explore/Dashboards already use -- a brand
    new check with nothing probed yet has no data at all, which is rendered
    as its own honest "Pending first check" state rather than guessed as
    either up or down (see PanelStatusMessage for the same never-fabricate
    principle applied to dashboard panels). */
function UptimeStatus({ checkName }: { checkName: string }) {
  const [dsStatus, setDsStatus] = useState<DatasourceStatus | null>(null);
  const [probe, setProbe] = useState<ProbeState>("loading");

  useEffect(() => {
    fetch("/api/datasource/metrics/status")
      .then((r) => r.json())
      .then(setDsStatus)
      .catch(() => setDsStatus({ configured: false }));
  }, []);

  useEffect(() => {
    if (!dsStatus?.configured) {
      setProbe("no_data");
      return;
    }
    let cancelled = false;
    setProbe("loading");
    // Deliberately NOT scoped by the global cluster selector -- synthetic
    // checks are tenant-wide, not tied to any cluster, and probe_success
    // carries no `cluster` label at all. Injecting one would make every
    // check show "no data" the moment any specific cluster is selected,
    // since the label-matcher query-gateway adds would never match a
    // series that doesn't have that label.
    const query = `probe_success{check_name="${checkName}"}`;
    fetch(`/api/datasource/metrics?query=${encodeURIComponent(query)}&range=now-5m`)
      .then((r) => r.json())
      .then((result: DatasourceQueryResult) => {
        if (cancelled) return;
        if (result.status !== "connected") {
          setProbe("no_data");
          return;
        }
        const points = result.series?.[0]?.points ?? [];
        if (points.length === 0) {
          setProbe("no_data");
          return;
        }
        setProbe(points[points.length - 1].value === 1 ? "up" : "down");
      })
      .catch(() => {
        if (!cancelled) setProbe("no_data");
      });
    return () => {
      cancelled = true;
    };
  }, [dsStatus, checkName]);

  if (!dsStatus?.configured) {
    return <span className="text-xs text-text-muted">Not signed in</span>;
  }
  if (probe === "loading") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-text-muted">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking…
      </span>
    );
  }
  if (probe === "no_data") {
    return (
      <span className="inline-flex items-center rounded border border-border bg-text-muted/15 px-1.5 py-0.5 text-xs text-text-secondary">
        Pending first check
      </span>
    );
  }
  if (probe === "up") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded border border-status-healthy/30 bg-status-healthy/15 px-1.5 py-0.5 text-xs text-status-healthy">
        <span className="h-1.5 w-1.5 rounded-full bg-status-healthy" />
        Up
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded border border-status-critical/30 bg-status-critical/15 px-1.5 py-0.5 text-xs text-status-critical">
      <span className="h-1.5 w-1.5 rounded-full bg-status-critical" />
      Down
    </span>
  );
}
