"use client";

import { useEffect, useState } from "react";
import { DashboardVariable } from "./types";
import type { DatasourceStatus } from "@/lib/datasource/types";
import { withClusterParam } from "@/lib/clusterContext";

/** Grafana query-variable syntax: `label_values(label)` or
    `label_values(metric{matchers}, label)`. The exported JSON never bakes in
    real options for these -- Grafana resolves them live against the
    datasource, which is exactly what this hook does instead. */
function parseLabelValuesQuery(raw: string | undefined): { matcher?: string; label: string } | null {
  if (!raw) return null;
  const match = raw.trim().match(/^label_values\((?:(.+),)?\s*([a-zA-Z_][a-zA-Z0-9_]*)\)$/);
  if (!match) return null;
  const [, matcher, label] = match;
  return { matcher: matcher?.trim(), label };
}

function substituteResolvedCurrents(text: string, resolvedCurrents: Map<string, string>): string {
  let out = text;
  resolvedCurrents.forEach((value, name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const token = new RegExp(`(?:\\$\\{${escaped}\\}|\\$${escaped}\\b)`, "g");
    out = out.replace(token, value === "All" ? ".*" : value);
  });
  return out;
}

/**
 * Real Grafana dashboards commonly chain "query" variables ($Node, $NameSpace,
 * $Container, $Pod, ...) where each one's own label_values() query is scoped
 * by the ones before it -- selecting a namespace should narrow which
 * containers/pods show up next, exactly like it would in Grafana itself.
 * Variables are resolved in their declared order (which is also their
 * dependency order in every dashboard this app ships), each one's matcher
 * substituting the *already-selected* current values of earlier variables.
 */
export function useResolvedVariables(
  variables: DashboardVariable[],
  dsStatus: DatasourceStatus | null,
  selectedCluster: string | null = null
): DashboardVariable[] {
  const [resolvedOptions, setResolvedOptions] = useState<Map<string, string[]>>(new Map());
  const [resolvedCurrents, setResolvedCurrents] = useState<Map<string, string>>(new Map());
  const currentsKey = variables.map((v) => `${v.name}=${v.current}`).join("|");

  useEffect(() => {
    if (!dsStatus?.configured) return;
    let cancelled = false;

    async function resolveAll() {
      // Local to this one resolve pass -- used only to cascade each
      // variable's effective current into the matchers of the variables
      // that come after it. Separate from the `resolvedCurrents` state above
      // (which holds the last COMPLETED pass's results) to avoid the two
      // being mistaken for each other.
      const cascadingCurrents = new Map<string, string>();
      const nextOptions = new Map<string, string[]>();
      const nextCurrents = new Map<string, string>();

      for (const v of variables) {
        const parsed = v.type === "query" ? parseLabelValuesQuery(v.query) : null;
        if (!parsed) {
          cascadingCurrents.set(v.name, v.current);
          continue;
        }

        const matcher = parsed.matcher ? substituteResolvedCurrents(parsed.matcher, cascadingCurrents) : undefined;
        const params = new URLSearchParams({ label: parsed.label });
        if (matcher) params.set("metric", matcher);

        let values: string[] = [];
        try {
          const res = await fetch(withClusterParam(`/api/datasource/metrics/labels?${params.toString()}`, selectedCluster));
          const json = (await res.json()) as { values: string[] };
          values = v.includeAll ? ["All", ...json.values] : json.values;
        } catch {
          values = [];
        }
        const options = values.length > 0 ? values : v.options;
        nextOptions.set(v.name, options);

        // The stored `current` is often stale or was never real to begin
        // with -- this dashboard's own JSON export carried empty options for
        // every variable, so every one of them started out on the literal
        // placeholder "All" (see normalizeVariables), and a later variable's
        // matcher built from an unresolved "All" (e.g. job="$job" ->
        // job=".*", an exact-match against the literal two characters ".*",
        // never a real series) would otherwise cascade that placeholder
        // into every variable that depends on it. Falling back to the first
        // REAL resolved option here (same auto-pick MetricsExplorer already
        // does for its own metric-name dropdown) is what makes the
        // cascade -- and the dropdown's actual displayed selection -- use
        // real values instead of silently inheriting "All" forever.
        const effectiveCurrent = options.includes(v.current) ? v.current : options[0] ?? v.current;
        cascadingCurrents.set(v.name, effectiveCurrent);
        nextCurrents.set(v.name, effectiveCurrent);
      }

      if (!cancelled) {
        setResolvedOptions(nextOptions);
        setResolvedCurrents(nextCurrents);
      }
    }

    resolveAll();
    return () => {
      cancelled = true;
    };
    // currentsKey is every (name, current) pair this cascade depends on --
    // `variables` itself is a new array on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dsStatus?.configured, currentsKey, selectedCluster]);

  if (!dsStatus?.configured) return variables;
  return variables.map((v) => {
    const options = resolvedOptions.get(v.name) ?? v.options;
    // `v.current` is this render's actual input -- e.g. the value the user
    // just clicked, already reflected in `variables` before the async
    // resolve pass triggered by that click has even started. Trusting it
    // whenever it's already a real option (as it will be right after a
    // click, since it was already in the previously-resolved list the user
    // picked it from) is what makes a selection stick immediately, instead
    // of a one-render-stale `resolvedCurrents` snapping it back to whatever
    // was selected before the click. `resolvedCurrents` is only consulted
    // as the fallback for a genuinely invalid current (the original "every
    // variable starts on the placeholder All" problem this hook exists to
    // fix), never used to override a value that's already valid.
    const current = options.includes(v.current) ? v.current : resolvedCurrents.get(v.name) ?? options[0] ?? v.current;
    return { ...v, options, current };
  });
}
