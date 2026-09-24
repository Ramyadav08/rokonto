// Single data-access facade used by every component. Nothing outside src/mock
// is imported directly by UI code -- when a real backend exists, this file
// (or an `api` module with the same shape) is the only thing that needs to
// change.

import { getRecentProblems } from "@/mock/services";
import {
  getKpiStrip,
  getResourceFlow,
  getNamespaceBreakdown,
  getNodeDistribution,
  getVolumeSeries,
  getTopMovers,
  VOLUME_RANGES,
  type VolumeRange,
} from "@/mock/overview";
import {
  getLogs,
  filterLogs,
  LOG_SERVICES,
  LOG_NAMESPACES,
  type LogFilters,
} from "@/mock/logs";
import {
  getMetricSeries,
  METRIC_NAMES,
  METRIC_SERVICES,
  METRIC_NAMESPACES,
  METRIC_PODS,
  AGGREGATIONS,
  GROUP_BY_OPTIONS,
  unitForMetric,
  type MetricQuery,
} from "@/mock/metrics";
import { getTraces, getTraceById, TRACE_SERVICES, TRACE_OPERATIONS } from "@/mock/traces";
import { getAlerts, getAlertById, formatDuration } from "@/mock/alerts";
import {
  listDashboards,
  getDashboard,
  saveDashboard,
  deleteDashboard,
  importDashboardJson,
  exportDashboardJson,
  isUserManaged,
} from "@/mock/dashboards";

export const mockData = {
  // overview
  getRecentProblems,
  getKpiStrip,
  getResourceFlow,
  getNamespaceBreakdown,
  getNodeDistribution,
  getVolumeSeries,
  getTopMovers,
  volumeRanges: VOLUME_RANGES,

  // explore / logs
  getLogs,
  filterLogs,
  logServices: LOG_SERVICES,
  logNamespaces: LOG_NAMESPACES,

  // explore / metrics
  getMetricSeries,
  metricNames: METRIC_NAMES,
  metricServices: METRIC_SERVICES,
  metricNamespaces: METRIC_NAMESPACES,
  metricPods: METRIC_PODS,
  aggregations: AGGREGATIONS,
  groupByOptions: GROUP_BY_OPTIONS,
  unitForMetric,

  // explore / traces
  getTraces,
  getTraceById,
  traceServices: TRACE_SERVICES,
  traceOperations: TRACE_OPERATIONS,

  // alerts
  getAlerts,
  getAlertById,
  formatDuration,

  // dashboards
  listDashboards,
  getDashboard,
  saveDashboard,
  deleteDashboard,
  importDashboardJson,
  exportDashboardJson,
  isUserManaged,
};

export type { LogFilters, MetricQuery, VolumeRange };
