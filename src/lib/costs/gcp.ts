import { BigQuery } from "@google-cloud/bigquery";
import type { CostBreakdownItem, MonthlyCostPoint, ProviderCost } from "./types";

/**
 * GCP has no direct "current spend" API -- the documented way to get real
 * cost is enabling detailed billing export to BigQuery and querying that
 * table (see https://cloud.google.com/billing/docs/how-to/export-data-bigquery).
 * That's a one-time setup on the GCP side we can't do for the user; this
 * just queries whatever table they've already exported to. The export
 * schema includes `service.description` and `project.name`, so service-
 * and project-level breakdowns (and the 6-month history) all come from
 * the same table.
 */
export async function getGcpCost(): Promise<ProviderCost> {
  const label = "GCP";
  const { GCP_BILLING_PROJECT_ID, GCP_BILLING_DATASET, GCP_BILLING_TABLE, GCP_SERVICE_ACCOUNT_JSON } = process.env;
  const hasCredentials = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS || GCP_SERVICE_ACCOUNT_JSON);

  if (!hasCredentials || !GCP_BILLING_PROJECT_ID || !GCP_BILLING_DATASET || !GCP_BILLING_TABLE) {
    return {
      provider: "gcp",
      label,
      status: "not_configured",
      detail:
        "Set GOOGLE_APPLICATION_CREDENTIALS (or GCP_SERVICE_ACCOUNT_JSON), GCP_BILLING_PROJECT_ID, GCP_BILLING_DATASET, GCP_BILLING_TABLE. Requires BigQuery billing export to already be enabled.",
    };
  }

  try {
    const credentials = GCP_SERVICE_ACCOUNT_JSON ? JSON.parse(GCP_SERVICE_ACCOUNT_JSON) : undefined;
    const bigquery = new BigQuery({ projectId: GCP_BILLING_PROJECT_ID, credentials });
    const table = `\`${GCP_BILLING_PROJECT_ID}.${GCP_BILLING_DATASET}.${GCP_BILLING_TABLE}\``;
    const whereMonthToDate = "WHERE DATE(usage_start_time) >= DATE_TRUNC(CURRENT_DATE(), MONTH)";
    const whereLast6Months = "WHERE DATE(usage_start_time) >= DATE_SUB(DATE_TRUNC(CURRENT_DATE(), MONTH), INTERVAL 5 MONTH)";

    const [[totalRows], [serviceRows], [projectRows], [historyRows]] = await Promise.all([
      bigquery.query({
        query: `SELECT SUM(cost) AS total_cost, ANY_VALUE(currency) AS currency FROM ${table} ${whereMonthToDate}`,
      }),
      bigquery.query({
        query: `
          SELECT service.description AS name, SUM(cost) AS amount
          FROM ${table} ${whereMonthToDate}
          GROUP BY name ORDER BY amount DESC LIMIT 8
        `,
      }),
      bigquery.query({
        query: `
          SELECT project.name AS name, SUM(cost) AS amount
          FROM ${table} ${whereMonthToDate}
          GROUP BY name ORDER BY amount DESC LIMIT 8
        `,
      }),
      bigquery.query({
        query: `
          SELECT FORMAT_DATE('%Y-%m', DATE(usage_start_time)) AS month, SUM(cost) AS amount
          FROM ${table} ${whereLast6Months}
          GROUP BY month ORDER BY month ASC
        `,
      }),
    ]);

    const totalRow = totalRows[0] as { total_cost?: number; currency?: string } | undefined;
    const services = (serviceRows as CostBreakdownItem[]).filter((s) => s.amount > 0);
    const projects = (projectRows as CostBreakdownItem[]).filter((p) => p.amount > 0);
    const history = historyRows as MonthlyCostPoint[];

    return {
      provider: "gcp",
      label,
      status: "connected",
      amount: totalRow?.total_cost ?? 0,
      currency: totalRow?.currency ?? "USD",
      services,
      projects: projects.length > 1 ? projects : undefined,
      history,
    };
  } catch (err) {
    return {
      provider: "gcp",
      label,
      status: "error",
      detail: err instanceof Error ? err.message : "Unknown error querying the BigQuery billing export.",
    };
  }
}
