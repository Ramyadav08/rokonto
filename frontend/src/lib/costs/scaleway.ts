import { lastMonthKeys } from "./dateRange";
import type { CostBreakdownItem, MonthlyCostPoint, ProviderCost } from "./types";

interface ScalewayInvoice {
  start_date?: string;
  stop_date?: string;
  total_untaxed?: ScalewayMoney;
  total_taxed?: ScalewayMoney;
}

interface ScalewayMoney {
  currency_code?: string;
  units?: string | number;
  nanos?: number;
}

interface ScalewayConsumption {
  value?: ScalewayMoney;
  amount?: number;
  category?: string;
  project_id?: string;
  project_name?: string;
}

function moneyToNumber(money: ScalewayMoney | undefined): number {
  if (!money) return 0;
  const units = Number(money.units ?? 0);
  const nanos = (money.nanos ?? 0) / 1_000_000_000;
  return units + nanos;
}

function amountOf(c: ScalewayConsumption): number {
  return c.value ? moneyToNumber(c.value) : c.amount ?? 0;
}

function groupBy(consumptions: ScalewayConsumption[], key: (c: ScalewayConsumption) => string | undefined): CostBreakdownItem[] {
  const totals = new Map<string, number>();
  for (const c of consumptions) {
    const name = key(c);
    if (!name) continue;
    totals.set(name, (totals.get(name) ?? 0) + amountOf(c));
  }
  return Array.from(totals.entries())
    .map(([name, amount]) => ({ name, amount }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Best-effort 6-month history from Scaleway's invoices, since the
 * consumptions endpoint only covers the current period. Schema here
 * (start_date/total_untaxed) is inferred from Scaleway's public API
 * conventions and not verified against a live account -- if it comes back
 * empty, the UI simply omits the trend for this provider instead of
 * showing wrong numbers.
 */
async function getScalewayHistory(secretKey: string, organizationId: string): Promise<MonthlyCostPoint[]> {
  const res = await fetch(
    `https://api.scaleway.com/billing/v2alpha1/invoices?organization_id=${encodeURIComponent(organizationId)}&page_size=12`,
    { headers: { "X-Auth-Token": secretKey } }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { invoices?: ScalewayInvoice[] };
  const invoices = data.invoices ?? [];

  const byMonth = new Map<string, number>();
  for (const inv of invoices) {
    if (!inv.start_date) continue;
    const month = inv.start_date.slice(0, 7);
    const amount = moneyToNumber(inv.total_untaxed ?? inv.total_taxed);
    byMonth.set(month, (byMonth.get(month) ?? 0) + amount);
  }

  return lastMonthKeys(6).map((month) => ({ month, amount: byMonth.get(month) ?? 0 }));
}

/**
 * Month-to-date consumption via Scaleway's Billing API. Scaleway's own
 * dashboard is the source of truth for exact billing category breakdowns;
 * this sums the reported consumption entries for a single top-line number,
 * plus a breakdown by category (service) and, if the response includes
 * project_id/project_name, by project.
 */
export async function getScalewayCost(): Promise<ProviderCost> {
  const label = "Scaleway";
  const { SCALEWAY_SECRET_KEY, SCALEWAY_ORGANIZATION_ID } = process.env;

  if (!SCALEWAY_SECRET_KEY || !SCALEWAY_ORGANIZATION_ID) {
    return {
      provider: "scaleway",
      label,
      status: "not_configured",
      detail: "Set SCALEWAY_SECRET_KEY and SCALEWAY_ORGANIZATION_ID for an IAM key with billing read access.",
    };
  }

  try {
    const res = await fetch(
      `https://api.scaleway.com/billing/v2alpha1/consumptions?organization_id=${encodeURIComponent(SCALEWAY_ORGANIZATION_ID)}`,
      { headers: { "X-Auth-Token": SCALEWAY_SECRET_KEY } }
    );
    if (!res.ok) {
      throw new Error(`Scaleway billing API returned ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { consumptions?: ScalewayConsumption[] };
    const consumptions = data.consumptions ?? [];
    if (consumptions.length === 0) {
      return { provider: "scaleway", label, status: "connected", amount: 0, currency: "EUR" };
    }

    const amount = consumptions.reduce((sum, c) => sum + amountOf(c), 0);
    const currency = consumptions[0]?.value?.currency_code ?? "EUR";
    const services = groupBy(consumptions, (c) => c.category).slice(0, 8);
    const projects = groupBy(consumptions, (c) => c.project_name ?? c.project_id);

    // Best-effort and schema-uncertain (see getScalewayHistory) -- never
    // let it turn an otherwise-successful fetch into an error.
    const history = await getScalewayHistory(SCALEWAY_SECRET_KEY, SCALEWAY_ORGANIZATION_ID).catch(() => []);

    return {
      provider: "scaleway",
      label,
      status: "connected",
      amount,
      currency,
      services: services.length > 0 ? services : undefined,
      projects: projects.length > 1 ? projects.slice(0, 8) : undefined,
      history: history.some((h) => h.amount > 0) ? history : undefined,
    };
  } catch (err) {
    return {
      provider: "scaleway",
      label,
      status: "error",
      detail: err instanceof Error ? err.message : "Unknown error calling the Scaleway billing API.",
    };
  }
}
