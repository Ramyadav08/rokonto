import type { MetricQuery } from "@/mock/metrics";

// A forgiving PromQL-*shaped* parser for the Metrics Explorer's Advanced
// mode. There's no real Prometheus behind this, so the goal isn't full
// PromQL compliance -- it's pulling out the handful of things we can map
// onto the existing mock generator (metric name, service/namespace/pod
// labels, an aggregation function, a "by (...)" grouping) so a
// PromQL-literate user gets a plausible result instead of a dead text box.
//
// Supported shapes:
//   metric_name
//   metric_name{service="x",namespace="y",pod="z"}
//   sum(metric_name{...})
//   sum(metric_name{...}) by (pod)
//   sum by (pod) (metric_name{...})
//
// Anything that doesn't parse falls back to treating the whole string as a
// bare metric name with default aggregation/grouping, rather than erroring.

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
  service: "Service",
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
    query: { metric: trimmed || "unknown_metric", service: "all", namespace: "all", pod: "all", aggregation: "Average", groupBy: "None" },
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
      service: labels.service ?? "all",
      namespace: labels.namespace ?? "all",
      pod: labels.pod ?? "all",
      aggregation: func ? AGG_MAP[func.toLowerCase()] ?? "Average" : "Average",
      groupBy: byLabel ? GROUP_BY_MAP[byLabel.trim().toLowerCase()] ?? "None" : "None",
    },
    recognized: true,
  };
}
