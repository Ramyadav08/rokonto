import { CostExplorerClient, GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";
import { lastMonthsRange, monthToDateRange } from "./dateRange";
import type { CostBreakdownItem, MonthlyCostPoint, ProviderCost } from "./types";

async function getGroupedCost(
  client: CostExplorerClient,
  timePeriod: { Start: string; End: string },
  dimension: "SERVICE" | "LINKED_ACCOUNT"
): Promise<CostBreakdownItem[]> {
  const result = await client.send(
    new GetCostAndUsageCommand({
      TimePeriod: timePeriod,
      Granularity: "MONTHLY",
      Metrics: ["UnblendedCost"],
      GroupBy: [{ Type: "DIMENSION", Key: dimension }],
    })
  );

  const groups = result.ResultsByTime?.[0]?.Groups ?? [];
  return groups
    .map((g) => ({
      name: g.Keys?.[0] ?? "Unknown",
      amount: Number(g.Metrics?.UnblendedCost?.Amount ?? 0),
    }))
    .filter((g) => g.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

async function getMonthlyHistory(client: CostExplorerClient): Promise<MonthlyCostPoint[]> {
  const { start, end } = lastMonthsRange(6);
  const result = await client.send(
    new GetCostAndUsageCommand({
      TimePeriod: { Start: start, End: end },
      Granularity: "MONTHLY",
      Metrics: ["UnblendedCost"],
    })
  );
  return (result.ResultsByTime ?? []).map((r) => ({
    month: (r.TimePeriod?.Start ?? "").slice(0, 7),
    amount: Number(r.Total?.UnblendedCost?.Amount ?? 0),
  }));
}

/**
 * Month-to-date unblended cost across the AWS account, via Cost Explorer,
 * plus a breakdown by service, by linked account (AWS's nearest equivalent
 * to "projects" -- an AWS Organizations member account), and a 6-month
 * monthly history. Cost Explorer only exists in us-east-1 regardless of
 * where resources actually live, so the client region is hardcoded.
 */
export async function getAwsCost(): Promise<ProviderCost> {
  const label = "AWS";
  if (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_PROFILE) {
    return {
      provider: "aws",
      label,
      status: "not_configured",
      detail: "Set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY (or AWS_PROFILE) with ce:GetCostAndUsage permission.",
    };
  }

  try {
    const client = new CostExplorerClient({ region: "us-east-1" });
    const { start, end } = monthToDateRange();
    const timePeriod = { Start: start, End: end };

    const [totalResult, services, projects, history] = await Promise.all([
      client.send(
        new GetCostAndUsageCommand({ TimePeriod: timePeriod, Granularity: "MONTHLY", Metrics: ["UnblendedCost"] })
      ),
      getGroupedCost(client, timePeriod, "SERVICE"),
      getGroupedCost(client, timePeriod, "LINKED_ACCOUNT"),
      getMonthlyHistory(client),
    ]);

    const total = totalResult.ResultsByTime?.[0]?.Total?.UnblendedCost;
    return {
      provider: "aws",
      label,
      status: "connected",
      amount: total ? Number(total.Amount) : 0,
      currency: total?.Unit ?? "USD",
      services: services.slice(0, 8),
      projects: projects.length > 1 ? projects : undefined,
      history,
    };
  } catch (err) {
    return {
      provider: "aws",
      label,
      status: "error",
      detail: err instanceof Error ? err.message : "Unknown error calling Cost Explorer.",
    };
  }
}
