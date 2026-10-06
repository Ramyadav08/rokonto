"use client";

import { DragEvent, useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronRight, Loader2, X } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface Cluster {
  id: string;
  name: string;
  env: string;
}

interface Namespace {
  id: string;
  name: string;
}

interface AccessGrant {
  clusterId: string;
  clusterName: string;
  clusterEnv: string;
  namespaceId: string | null;
  namespaceName: string | null;
}

/** Per cluster: `full` means "every namespace" (namespaceId: null on save);
    otherwise `namespaces` holds the specific namespace ids granted. A
    cluster with neither is simply absent from this map -- no grant at all. */
type AccessState = Record<string, { full: boolean; namespaces: Set<string> }>;

type LoadState = { status: "loading" } | { status: "error"; detail: string } | { status: "loaded" };

export function AccessEditor({ userId, userEmail, onClose }: { userId: string; userEmail: string; onClose: () => void }) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [access, setAccess] = useState<AccessState>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [namespacesByCluster, setNamespacesByCluster] = useState<Record<string, Namespace[] | "loading" | "error">>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/admin/clusters").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`clusters: ${r.status}`)))),
      fetch(`/api/admin/users/${userId}/access`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`access: ${r.status}`)))),
    ])
      .then(([clusterList, grants]: [Cluster[], AccessGrant[]]) => {
        if (cancelled) return;
        setClusters(clusterList);
        const next: AccessState = {};
        for (const g of grants) {
          if (g.namespaceId === null) {
            next[g.clusterId] = { full: true, namespaces: new Set() };
          } else {
            const cur = next[g.clusterId] ?? { full: false, namespaces: new Set<string>() };
            if (!cur.full) cur.namespaces.add(g.namespaceId);
            next[g.clusterId] = cur;
          }
        }
        setAccess(next);
        setLoad({ status: "loaded" });
      })
      .catch((err) => {
        if (!cancelled) setLoad({ status: "error", detail: err instanceof Error ? err.message : "Could not load access." });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  function toggleExpanded(clusterId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(clusterId)) {
        next.delete(clusterId);
      } else {
        next.add(clusterId);
        if (!namespacesByCluster[clusterId]) {
          setNamespacesByCluster((m) => ({ ...m, [clusterId]: "loading" }));
          fetch(`/api/admin/clusters/${clusterId}/namespaces`)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((namespaces: Namespace[]) => setNamespacesByCluster((m) => ({ ...m, [clusterId]: namespaces })))
            .catch(() => setNamespacesByCluster((m) => ({ ...m, [clusterId]: "error" })));
        }
      }
      return next;
    });
  }

  function toggleFull(clusterId: string) {
    setAccess((prev) => {
      if (prev[clusterId]?.full) {
        const next = { ...prev };
        delete next[clusterId];
        return next;
      }
      return { ...prev, [clusterId]: { full: true, namespaces: new Set() } };
    });
  }

  function addNamespace(clusterId: string, namespaceId: string) {
    setAccess((prev) => {
      const cur = prev[clusterId];
      const namespaces = new Set(cur && !cur.full ? cur.namespaces : []);
      namespaces.add(namespaceId);
      return { ...prev, [clusterId]: { full: false, namespaces } };
    });
  }

  function removeNamespace(clusterId: string, namespaceId: string) {
    setAccess((prev) => {
      const cur = prev[clusterId];
      if (!cur || cur.full) return prev;
      const namespaces = new Set(cur.namespaces);
      namespaces.delete(namespaceId);
      if (namespaces.size === 0) {
        const next = { ...prev };
        delete next[clusterId];
        return next;
      }
      return { ...prev, [clusterId]: { full: false, namespaces } };
    });
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    const grants: { clusterId: string; namespaceId: string | null }[] = [];
    for (const [clusterId, state] of Object.entries(access)) {
      if (state.full) {
        grants.push({ clusterId, namespaceId: null });
      } else {
        Array.from(state.namespaces).forEach((namespaceId) => grants.push({ clusterId, namespaceId }));
      }
    }
    try {
      const res = await fetch(`/api/admin/users/${userId}/access`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grants }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(payload.error ?? `Could not save access (${res.status}).`);
        return;
      }
      setSaved(true);
    } catch {
      setSaveError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="w-80 shrink-0 self-start">
      <CardHeader>
        <CardTitle className="truncate" title={userEmail}>
          Access · {userEmail}
        </CardTitle>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardBody className="space-y-1">
        {load.status === "loading" ? (
          <div className="flex items-center gap-1.5 py-4 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : load.status === "error" ? (
          <div className="flex items-center gap-1.5 py-4 text-sm text-status-critical">
            <AlertTriangle className="h-4 w-4" />
            {load.detail}
          </div>
        ) : clusters.length === 0 ? (
          <div className="py-4 text-sm text-text-muted">No clusters exist yet.</div>
        ) : (
          <>
            {clusters.map((c) => (
              <ClusterRow
                key={c.id}
                cluster={c}
                expanded={expanded.has(c.id)}
                onToggleExpanded={() => toggleExpanded(c.id)}
                state={access[c.id]}
                onToggleFull={() => toggleFull(c.id)}
                namespaces={namespacesByCluster[c.id]}
                onAddNamespace={(nsId) => addNamespace(c.id, nsId)}
                onRemoveNamespace={(nsId) => removeNamespace(c.id, nsId)}
              />
            ))}
            <div className="pt-2">
              <Button variant="primary" onClick={handleSave} disabled={saving} className="w-full justify-center">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save access
              </Button>
              {saveError && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-status-critical">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {saveError}
                </div>
              )}
              {saved && <div className="mt-1.5 text-xs text-status-healthy">Saved.</div>}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function ClusterRow({
  cluster,
  expanded,
  onToggleExpanded,
  state,
  onToggleFull,
  namespaces,
  onAddNamespace,
  onRemoveNamespace,
}: {
  cluster: Cluster;
  expanded: boolean;
  onToggleExpanded: () => void;
  state: { full: boolean; namespaces: Set<string> } | undefined;
  onToggleFull: () => void;
  namespaces: Namespace[] | "loading" | "error" | undefined;
  onAddNamespace: (namespaceId: string) => void;
  onRemoveNamespace: (namespaceId: string) => void;
}) {
  const checkboxRef = useRef<HTMLInputElement>(null);
  const partial = Boolean(state && !state.full && state.namespaces.size > 0);
  const full = Boolean(state?.full);

  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = partial;
  }, [partial]);

  return (
    <div>
      <div className="flex items-center gap-1.5 py-1">
        <button onClick={onToggleExpanded} className="text-text-muted hover:text-text-primary" aria-label="Expand namespaces">
          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </button>
        <input ref={checkboxRef} type="checkbox" checked={full} onChange={onToggleFull} className="h-3.5 w-3.5" />
        <span className="text-sm text-text-primary">{cluster.name}</span>
        <span className="text-xs text-text-muted">{cluster.env}</span>
        {full && <span className="text-xs text-text-muted">· full access</span>}
      </div>
      {expanded && (
        <div className="ml-8 border-l border-border pl-2.5 py-1">
          {full ? (
            <div className="text-xs text-text-muted">Full access grants every namespace -- nothing to pick individually.</div>
          ) : namespaces === "loading" || namespaces === undefined ? (
            <div className="flex items-center gap-1.5 py-1 text-xs text-text-muted">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading…
            </div>
          ) : namespaces === "error" ? (
            <div className="flex items-center gap-1.5 py-1 text-xs text-status-critical">
              <AlertTriangle className="h-3 w-3" />
              Could not load namespaces.
            </div>
          ) : namespaces.length === 0 ? (
            <div className="py-1 text-xs text-text-muted">No namespaces reported yet.</div>
          ) : (
            <NamespaceDnd
              namespaces={namespaces}
              granted={state?.namespaces ?? new Set()}
              onAdd={onAddNamespace}
              onRemove={onRemoveNamespace}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Native HTML5 drag-and-drop between two columns -- no DnD library in this
    codebase, and one dropped namespace is a small enough interaction that
    the handful of DOM events (draggable/onDragStart/onDragOver/onDrop) cover
    it without one. Each column's onDrop just ensures the dropped namespace
    ends up in that column's set -- dropping back where it already was is a
    harmless no-op, so there's no need to also track which column a drag
    started from. */
function NamespaceDnd({
  namespaces,
  granted,
  onAdd,
  onRemove,
}: {
  namespaces: Namespace[];
  granted: Set<string>;
  onAdd: (namespaceId: string) => void;
  onRemove: (namespaceId: string) => void;
}) {
  const [dragOver, setDragOver] = useState<"available" | "granted" | null>(null);
  const available = namespaces.filter((ns) => !granted.has(ns.id));
  const grantedList = namespaces.filter((ns) => granted.has(ns.id));

  function handleDragStart(e: DragEvent, namespaceId: string) {
    e.dataTransfer.setData("text/plain", namespaceId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDrop(e: DragEvent, target: "available" | "granted") {
    e.preventDefault();
    setDragOver(null);
    const namespaceId = e.dataTransfer.getData("text/plain");
    if (!namespaceId) return;
    if (target === "granted") onAdd(namespaceId);
    else onRemove(namespaceId);
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <NamespaceColumn
        title="Available"
        namespaces={available}
        isDragOver={dragOver === "available"}
        onDragStart={handleDragStart}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver("available");
        }}
        onDragLeave={() => setDragOver(null)}
        onDrop={(e) => handleDrop(e, "available")}
      />
      <NamespaceColumn
        title="Granted"
        namespaces={grantedList}
        isDragOver={dragOver === "granted"}
        onDragStart={handleDragStart}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver("granted");
        }}
        onDragLeave={() => setDragOver(null)}
        onDrop={(e) => handleDrop(e, "granted")}
      />
    </div>
  );
}

function NamespaceColumn({
  title,
  namespaces,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  title: string;
  namespaces: Namespace[];
  isDragOver: boolean;
  onDragStart: (e: DragEvent, namespaceId: string) => void;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent) => void;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`min-h-[72px] space-y-1 rounded-md border p-1.5 transition-colors ${
        isDragOver ? "border-accent-blue bg-accent-blue/5" : "border-border"
      }`}
    >
      <div className="px-0.5 text-[10px] uppercase tracking-wide text-text-muted">{title}</div>
      {namespaces.length === 0 ? (
        <div className="px-0.5 py-1 text-xs text-text-muted">Drop here</div>
      ) : (
        namespaces.map((ns) => (
          <div
            key={ns.id}
            draggable
            onDragStart={(e) => onDragStart(e, ns.id)}
            className="cursor-grab rounded border border-border bg-surface-raised px-1.5 py-1 text-xs text-text-secondary active:cursor-grabbing"
            title={ns.name}
          >
            {ns.name}
          </div>
        ))
      )}
    </div>
  );
}
