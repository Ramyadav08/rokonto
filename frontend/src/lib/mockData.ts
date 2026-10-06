// Single data-access facade used by every component. Nothing outside src/mock
// is imported directly by UI code -- when a real backend exists, this file
// (or an `api` module with the same shape) is the only thing that needs to
// change.

import { getTraces, getTraceById, TRACE_SERVICES, TRACE_OPERATIONS } from "@/mock/traces";
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
  // explore / traces
  getTraces,
  getTraceById,
  traceServices: TRACE_SERVICES,
  traceOperations: TRACE_OPERATIONS,

  // dashboards
  listDashboards,
  getDashboard,
  saveDashboard,
  deleteDashboard,
  importDashboardJson,
  exportDashboardJson,
  isUserManaged,
};
