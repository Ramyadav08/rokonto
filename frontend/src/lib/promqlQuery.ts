// A forgiving PromQL-*shaped* parser for the Metrics Explorer's Advanced
// mode. The goal isn't full PromQL compliance -- it's pulling out the
// handful of things the Builder's own dropdowns edit (metric name,
// namespace/pod/container labels, an aggregation function, a "by (...)"
// grouping) so a PromQL-literate user gets a real result instead of a dead
// text box.
//
// Supported shapes:
//   metric_name
//   metric_name{namespace="x",pod="y",container="z"}
//   sum(metric_name{...})
//   sum(metric_name{...}) by (pod)
//   sum by (pod) (metric_name{...})
//
// Anything that doesn't parse falls back to treating the whole string as a
// bare metric name with default aggregation/grouping, rather than erroring.

export interface MetricQuery {
  metric: string;
  namespace: string;
  pod: string;
  container: string;
  aggregation: string;
  groupBy: string;
}

// Fixed UI vocabulary for the Metrics Explorer's Builder mode -- not
// datasource-backed data, just the aggregation/grouping choices the builder
// offers, each mapped onto a real PromQL function/`by (...)` clause.
// "Container" (not "Service"): real metrics carry cluster/namespace/pod/
// container labels (see the cluster-agent's discovery.relabel step) -- there
// is no "service" label in the real pipeline.
export const AGGREGATION_OPTIONS = ["Average", "Sum", "Max", "Min", "p95"];
export const GROUP_BY_OPTIONS = ["None", "Pod", "Namespace", "Container"];

const AGG_MAP: Record<string, string> = {
  sum: "Sum",
  avg: "Average",
  average: "Average",
  max: "Max",
  min: "Min",
  quantile: "p95",
  topk: "Max",
};

const GROUP_BY_MAP: Record<string, string> = {
  pod: "Pod",
  namespace: "Namespace",
  container: "Container",
};

export interface ParsedPromQL {
  query: MetricQuery;
  recognized: boolean;
}

function parseLabels(block: string | undefined): Record<string, string> {
  const labels: Record<string, string> = {};
  if (!block) return labels;
  const re = /(\w+)\s*=~?\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    labels[m[1].toLowerCase()] = m[2];
  }
  return labels;
}

export function parsePromQL(raw: string): ParsedPromQL {
  const trimmed = raw.trim();
  const fallback: ParsedPromQL = {
    query: { metric: trimmed || "unknown_metric", namespace: "all", pod: "all", container: "all", aggregation: "Average", groupBy: "None" },
    recognized: false,
  };
  if (!trimmed) return fallback;

  let func: string | undefined;
  let byLabel: string | undefined;
  let inner = trimmed;

  // sum by (pod) (metric{...})
  const preByMatch = trimmed.match(/^(\w+)\s+by\s*\(([^)]*)\)\s*\(([\s\S]*)\)$/i);
  // sum(metric{...}) by (pod)   -- or just sum(metric{...})
  // The inner group must be non-greedy: otherwise, with an optional trailing
  // "by (...)", greedy backtracking finds the string's LAST ")" first and
  // swallows " by (pod" into the inner capture instead of stopping at the
  // function call's own closing paren.
  const postByMatch = trimmed.match(/^(\w+)\s*\(([\s\S]*?)\)\s*(?:by\s*\(([^)]*)\))?$/i);

  if (preByMatch) {
    [, func, byLabel, inner] = preByMatch;
  } else if (postByMatch && AGG_MAP[postByMatch[1].toLowerCase()]) {
    [, func, inner, byLabel] = postByMatch;
  }

  const selectorMatch = inner.trim().match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\s*(?:\{([^}]*)\})?$/);
  if (!selectorMatch) return fallback;

  const [, metric, labelBlock] = selectorMatch;
  const labels = parseLabels(labelBlock);

  return {
    query: {
      metric,
      namespace: labels.namespace ?? "all",
      pod: labels.pod ?? "all",
      container: labels.container ?? "all",
      aggregation: func ? AGG_MAP[func.toLowerCase()] ?? "Average" : "Average",
      groupBy: byLabel ? GROUP_BY_MAP[byLabel.trim().toLowerCase()] ?? "None" : "None",
    },
    recognized: true,
  };
}
