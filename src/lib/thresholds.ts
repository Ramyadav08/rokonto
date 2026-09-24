import { PanelThresholdStep } from "@/dashboard/types";

const COLOR_MAP: Record<string, string> = {
  green: "#22c55e",
  orange: "#eab308",
  red: "#ef4444",
  yellow: "#eab308",
  "#EAB839": "#eab308",
};

const NEUTRAL_COLOR = "#3b82f6";

export function resolveColor(rawColor: string): string {
  return COLOR_MAP[rawColor] ?? rawColor;
}

// Grafana's own convention: 70%/90% of range is a reasonable "getting hot"
// default, but only for percent-like units. For an arbitrary count (pods,
// nodes, ...) with no explicit thresholds configured, there's no sensible
// danger zone to guess at -- color it neutrally instead of implying risk.
const DEFAULT_PERCENTUNIT_STEPS: PanelThresholdStep[] = [
  { color: "green", value: null },
  { color: "orange", value: 0.7 },
  { color: "red", value: 0.9 },
];

const DEFAULT_PERCENT_STEPS: PanelThresholdStep[] = [
  { color: "green", value: null },
  { color: "orange", value: 70 },
  { color: "red", value: 90 },
];

export function colorForValue(
  value: number,
  steps: PanelThresholdStep[] | undefined,
  max: number | undefined,
  unit: string | undefined
): string {
  let list = steps && steps.length > 0 ? steps : undefined;
  if (!list) {
    if (unit === "percentunit") list = DEFAULT_PERCENTUNIT_STEPS;
    else if (unit === "percent") list = DEFAULT_PERCENT_STEPS;
    else return NEUTRAL_COLOR;
  }

  // Steps come sorted ascending with the first step's value = null (the floor).
  // Percent-based threshold sets (grafana "mode": "percentage") assume 0-100;
  // scale them against max when the panel's actual values live in a
  // different range (e.g. 0-1 for percentunit).
  const usesPercentScale = list.some((s) => (s.value ?? 0) > 1) && max !== undefined && max <= 1;
  let active = list[0];
  for (const step of list) {
    const stepValue = step.value ?? -Infinity;
    const comparableValue = usesPercentScale ? stepValue / 100 : stepValue;
    if (value >= comparableValue) active = step;
  }
  return resolveColor(active.color);
}
