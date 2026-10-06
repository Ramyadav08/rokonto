"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, HelpCircle, Loader2, Sparkles, X } from "lucide-react";
import { LogEntry, realLogLevel } from "@/lib/datasource/queryGateway";
import { filterLogsByQuery } from "@/lib/logQuery";
import { Select } from "@/components/ui/Select";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/cn";
import { TIME_RANGE_PRESETS } from "@/dashboard/types";
import { useSelectedCluster, withClusterParam } from "@/lib/clusterContext";

const QUERY_HELP = [
  'namespace="default"     exact match on a real stream label',
  "pod!=nginx-abc123       negated match",
  "timeout                 word anywhere in the message",
  '"connection refused"    exact phrase',
  "",
  "Fields: namespace, pod, container, cluster",
  "Combine terms with a space -- they all must match (AND).",
].join("\n");

type LoadState = { status: "loading" } | { status: "error"; detail: string } | { status: "not_configured" } | { status: "loaded" };

const LEVEL_COLOR: Record<string, string> = {
  ERROR: "text-status-critical",
  WARN: "text-status-warning",
  INFO: "text-status-info",
  DEBUG: "text-text-muted",
};

export function LogsExplorer() {
  const searchParams = useSearchParams();
  const around = searchParams.get("around");
  const hint = searchParams.get("q") ?? undefined;
  const { selectedCluster } = useSelectedCluster();

  const [timeRange, setTimeRange] = useState("now-15m");
  const [namespace, setNamespace] = useState("all");
  const [container, setContainer] = useState("all");
  const [level, setLevel] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<LogEntry | null>(null);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [baseLogs, setBaseLogs] = useState<LogEntry[]>([]);
  const [namespaceOptions, setNamespaceOptions] = useState<string[]>([]);
  const [containerOptions, setContainerOptions] = useState<string[]>([]);

  // The complete, real set of namespace/container values across every log
  // stream the caller can see -- fetched independently of the displayed
  // window/limit, so a quiet workload's namespace isn't missing from the
  // dropdown just because noisier pods crowded it out of the most recent
  // 300 lines (see /api/datasource/logs/labels for why this can't just be
  // derived from baseLogs).
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (namespace !== "all") params.set("namespace", namespace);
    fetch(withClusterParam(`/api/datasource/logs/labels?${params.toString()}`, selectedCluster))
      .then((r) => r.json())
      .then((result: { namespaces?: string[]; containers?: string[] }) => {
        if (cancelled) return;
        setNamespaceOptions(result.namespaces ?? []);
        setContainerOptions(result.containers ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setNamespaceOptions([]);
          setContainerOptions([]);
        }
      });
    return () => {
      cancelled = true;
    };
    // Re-fetch when namespace changes so the Container list narrows to only
    // what actually exists in that namespace -- not every container across
    // every namespace regardless of the Namespace dropdown's selection.
  }, [selectedCluster, namespace]);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    const params = new URLSearchParams({ range: timeRange, limit: "300" });
    if (around) {
      params.set("end", String(Number(around) + 5 * 60_000));
      params.set("range", "now-10m");
    }
    fetch(withClusterParam(`/api/datasource/logs?${params.toString()}`, selectedCluster))
      .then((r) => r.json())
      .then((result: { status: string; entries?: LogEntry[]; detail?: string }) => {
        if (cancelled) return;
        if (result.status === "not_configured") {
          setState({ status: "not_configured" });
          setBaseLogs([]);
          return;
        }
        if (result.status !== "connected") {
          setState({ status: "error", detail: result.detail ?? "Could not load logs." });
          setBaseLogs([]);
          return;
        }
        setBaseLogs(result.entries ?? []);
        setState({ status: "loaded" });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ status: "error", detail: err instanceof Error ? err.message : "Could not reach the server." });
        setBaseLogs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [timeRange, around, selectedCluster]);

  const logs = useMemo(() => {
    const byDropdowns = baseLogs.filter((log) => {
      if (namespace !== "all" && log.labels.namespace !== namespace) return false;
      if (container !== "all" && log.labels.container !== container) return false;
      if (level !== "all" && realLogLevel(log) !== level) return false;
      return true;
    });
    return filterLogsByQuery(byDropdowns, query);
  }, [baseLogs, namespace, container, level, query]);

  useEffect(() => {
    if (around) setSelected(baseLogs[0] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [around, baseLogs]);

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        {around && (
          <div className="flex items-center gap-2 border-b border-border bg-accent-blue/10 px-4 py-2 text-xs text-accent-blue">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span>
              Showing logs around {formatClock(Number(around))}
              {hint ? ` correlated with "${hint}"` : ""}
            </span>
            <Link href="/explore/logs" className="ml-auto flex items-center gap-1 text-text-secondary hover:text-text-primary">
              <X className="h-3.5 w-3.5" />
              Clear
            </Link>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <Select options={TIME_RANGE_PRESETS} value={timeRange} onChange={(e) => setTimeRange(e.target.value)} />
          <Select
            options={[{ label: "All namespaces", value: "all" }, ...namespaceOptions.map((n) => ({ label: n, value: n }))]}
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
          />
          <Select
            options={[{ label: "All containers", value: "all" }, ...containerOptions.map((c) => ({ label: c, value: c }))]}
            value={container}
            onChange={(e) => setContainer(e.target.value)}
          />
          <Select
            options={["all", "ERROR", "WARN", "INFO", "DEBUG"].map((l) => ({
              label: l === "all" ? "All levels" : l,
              value: l,
            }))}
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          />
          <div className="relative min-w-[240px] flex-1">
            <input
              className="w-full rounded-md border border-border bg-surface-raised py-1.5 pl-2.5 pr-7 font-mono text-xs text-text-primary outline-none focus:border-accent-blue"
              placeholder='namespace="default" timeout'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              spellCheck={false}
            />
            <span
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-help text-text-muted"
              title={QUERY_HELP}
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </span>
          </div>
          <span className="ml-auto text-xs text-text-muted">
            {state.status === "loaded" ? `${logs.length} results` : ""}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto font-mono text-xs">
          {state.status === "loading" ? (
            <div className="flex items-center gap-1.5 p-6 text-sm text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading logs…
            </div>
          ) : state.status === "not_configured" ? (
            <div className="p-6 text-center text-sm text-text-muted">Not signed in.</div>
          ) : state.status === "error" ? (
            <div className="flex items-center justify-center gap-1.5 p-6 text-sm text-status-critical">
              <AlertTriangle className="h-4 w-4" />
              {state.detail}
            </div>
          ) : logs.length === 0 ? (
            <div className="p-6 text-center text-sm text-text-muted">
              {baseLogs.length === 0
                ? "No logs reported for this window yet. If no agent has been deployed, or nothing has logged recently, this is expected."
                : "No logs match the current filters."}
            </div>
          ) : (
            logs.slice(0, 300).map((log) => {
              const lvl = realLogLevel(log);
              return (
                <button
                  key={log.id}
                  onClick={() => setSelected(log)}
                  className={cn(
                    "flex w-full items-start gap-2 border-b border-border/40 px-4 py-1.5 text-left hover:bg-surface-hover",
                    selected?.id === log.id && "bg-surface-hover"
                  )}
                >
                  <span className="shrink-0 text-text-muted">{formatClock(log.timestamp)}</span>
                  <span className={cn("w-12 shrink-0 font-medium", LEVEL_COLOR[lvl])}>{lvl}</span>
                  <span className="w-40 shrink-0 truncate text-accent-blue">
                    {log.labels.namespace ?? ""}/{log.labels.pod ?? log.labels.container ?? ""}
                  </span>
                  <span className="truncate text-text-secondary">{log.message}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {selected && (
        <div className="w-80 shrink-0 overflow-y-auto border-l border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-medium text-text-primary">Log details</h3>
            <button onClick={() => setSelected(null)} className="text-text-muted hover:text-text-primary">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-3 px-4 py-4 text-xs">
            <Detail label="Timestamp" value={new Date(selected.timestamp).toISOString()} />
            <Detail
              label="Level"
              value={realLogLevel(selected)}
              valueClass={LEVEL_COLOR[realLogLevel(selected)]}
            />
            <Detail label="Message" value={selected.message} mono />
            <div>
              <div className="mb-1 text-text-muted">Labels</div>
              <div className="space-y-1">
                {Object.entries(selected.labels).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2 rounded bg-surface-raised px-2 py-1">
                    <span className="text-text-muted">{k}</span>
                    <span className="truncate text-text-secondary">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, mono, valueClass }: { label: string; value: string; mono?: boolean; valueClass?: string }) {
  return (
    <div>
      <div className="mb-0.5 text-text-muted">{label}</div>
      <div className={cn("break-all text-text-primary", mono && "font-mono", valueClass)}>{value}</div>
    </div>
  );
}
