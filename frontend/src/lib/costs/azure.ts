import { lastMonthsRange } from "./dateRange";
import type { CostBreakdownItem, MonthlyCostPoint, ProviderCost } from "./types";

interface CostManagementResponse {
  properties?: { columns?: { name: string }[]; rows?: (number | string)[][] };
}

async function queryCostManagement(
  subscriptionId: string,
  accessToken: string,
  options: {
    grouping?: { type: "Dimension"; name: string }[];
    granularity?: "None" | "Monthly";
    timeframe?: "MonthToDate" | "Custom";
    timePeriod?: { from: string; to: string };
  } = {}
): Promise<CostManagementResponse> {
  const res = await fetch(
    `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.CostManagement/query?api-version=2023-11-01`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "ActualCost",
        timeframe: options.timeframe ?? "MonthToDate",
        ...(options.timePeriod ? { timePeriod: options.timePeriod } : {}),
        dataset: {
          granularity: options.granularity ?? "None",
          aggregation: { totalCost: { name: "PreTaxCost", function: "Sum" } },
          ...(options.grouping ? { grouping: options.grouping } : {}),
        },
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Cost Management query failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function totalFrom(response: CostManagementResponse): { amount: number; currency: string } {
  const columns = response.properties?.columns ?? [];
  const row = response.properties?.rows?.[0] ?? [];
  const costIdx = columns.findIndex((c) => c.name === "PreTaxCost");
  const currencyIdx = columns.findIndex((c) => c.name === "Currency");
  return {
    amount: costIdx >= 0 ? Number(row[costIdx]) : 0,
    currency: currencyIdx >= 0 ? String(row[currencyIdx]) : "USD",
  };
}

function breakdownFrom(response: CostManagementResponse, groupColumnName: string): CostBreakdownItem[] {
  const columns = response.properties?.columns ?? [];
  const rows = response.properties?.rows ?? [];
  const costIdx = columns.findIndex((c) => c.name === "PreTaxCost");
  const nameIdx = columns.findIndex((c) => c.name === groupColumnName);
  if (costIdx < 0 || nameIdx < 0) return [];

  return rows
    .map((row) => ({ name: String(row[nameIdx] ?? "Unknown"), amount: Number(row[costIdx] ?? 0) }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

/** Azure returns the month bucket as an int date like 20260401 (granularity=Monthly) in a "UsageDate" column. */
function historyFrom(response: CostManagementResponse): MonthlyCostPoint[] {
  const columns = response.properties?.columns ?? [];
  const rows = response.properties?.rows ?? [];
  const costIdx = columns.findIndex((c) => c.name === "PreTaxCost");
  const dateIdx = columns.findIndex((c) => c.name === "UsageDate");
  if (costIdx < 0 || dateIdx < 0) return [];

  return rows
    .map((row) => {
      const raw = String(row[dateIdx] ?? "");
      const month = raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}` : raw;
      return { month, amount: Number(row[costIdx] ?? 0) };
    })
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Plain REST calls (OAuth2 client-credentials + Cost Management Query API)
 * instead of the @azure/* SDKs -- keeps this to a single dependency-free
 * fetch instead of a large SDK, and avoids @azure/arm-costmanagement's
 * Node >=22 engine requirement. Breaks down by service (ServiceName), by
 * resource group (the nearest thing Azure has to "projects" within one
 * subscription), and by month for the last 6 months.
 */
export async function getAzureCost(): Promise<ProviderCost> {
  const label = "Azure";
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_SUBSCRIPTION_ID } = process.env;

  if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET || !AZURE_SUBSCRIPTION_ID) {
    return {
      provider: "azure",
      label,
      status: "not_configured",
      detail: "Set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_SUBSCRIPTION_ID for an app with Cost Management Reader access.",
    };
  }

  try {
    const tokenRes = await fetch(`https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: AZURE_CLIENT_ID,
        client_secret: AZURE_CLIENT_SECRET,
        scope: "https://management.azure.com/.default",
      }),
    });
    if (!tokenRes.ok) {
      throw new Error(`Azure AD token request failed: ${tokenRes.status} ${await tokenRes.text()}`);
    }
    const { access_token } = (await tokenRes.json()) as { access_token: string };
    const { start, end } = lastMonthsRange(6);

    const [totalRes, byService, byResourceGroup, byMonth] = await Promise.all([
      queryCostManagement(AZURE_SUBSCRIPTION_ID, access_token),
      queryCostManagement(AZURE_SUBSCRIPTION_ID, access_token, { grouping: [{ type: "Dimension", name: "ServiceName" }] }),
      queryCostManagement(AZURE_SUBSCRIPTION_ID, access_token, {
        grouping: [{ type: "Dimension", name: "ResourceGroupName" }],
      }),
      queryCostManagement(AZURE_SUBSCRIPTION_ID, access_token, {
        granularity: "Monthly",
        timeframe: "Custom",
        timePeriod: { from: start, to: end },
      }),
    ]);

    const { amount, currency } = totalFrom(totalRes);
    const services = breakdownFrom(byService, "ServiceName").slice(0, 8);
    const projects = breakdownFrom(byResourceGroup, "ResourceGroupName");
    const history = historyFrom(byMonth);

    return {
      provider: "azure",
      label,
      status: "connected",
      amount,
      currency,
      services,
      projects: projects.length > 1 ? projects.slice(0, 8) : undefined,
      history,
    };
  } catch (err) {
    return {
      provider: "azure",
      label,
      status: "error",
      detail: err instanceof Error ? err.message : "Unknown error calling Cost Management.",
    };
  }
}
