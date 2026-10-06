import { DashboardVariable, ObservexPanel } from "@/dashboard/types";
import { StatPanel } from "@/components/visualizations/StatPanel";
import { TimeSeriesPanel } from "@/components/visualizations/TimeSeriesPanel";
import { GaugePanel } from "@/components/visualizations/GaugePanel";
import { BarGaugePanel } from "@/components/visualizations/BarGaugePanel";
import { BarChartPanel } from "@/components/visualizations/BarChartPanel";
import { TablePanel } from "@/components/visualizations/TablePanel";
import { LogsPanel } from "@/components/visualizations/LogsPanel";
import { TextPanel } from "@/components/visualizations/TextPanel";
import { UnsupportedPanel } from "@/components/visualizations/UnsupportedPanel";

/** Dispatches a single normalized panel to its visualization component. */
export function PanelRenderer({
  panel,
  timeRange = "now-6h",
  variables = [],
}: {
  panel: ObservexPanel;
  timeRange?: string;
  variables?: DashboardVariable[];
}) {
  switch (panel.type) {
    case "stat":
      return <StatPanel panel={panel} timeRange={timeRange} variables={variables} />;
    case "gauge":
      return <GaugePanel panel={panel} timeRange={timeRange} variables={variables} />;
    case "bargauge":
      return <BarGaugePanel panel={panel} timeRange={timeRange} variables={variables} />;
    case "timeseries":
      return <TimeSeriesPanel panel={panel} timeRange={timeRange} variables={variables} />;
    case "barchart":
      return <BarChartPanel panel={panel} timeRange={timeRange} variables={variables} />;
    case "table":
      return <TablePanel panel={panel} timeRange={timeRange} variables={variables} />;
    case "logs":
      return <LogsPanel panel={panel} />;
    case "text":
      return <TextPanel panel={panel} />;
    case "row":
      return null;
    case "heatmap":
    case "unsupported":
    default:
      return <UnsupportedPanel panel={panel} />;
  }
}
