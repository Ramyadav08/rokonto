import { getAwsCost } from "./aws";
import { getGcpCost } from "./gcp";
import { getAzureCost } from "./azure";
import { getScalewayCost } from "./scaleway";
import { lastMonthKeys } from "./dateRange";
import type { CostBreakdownItem, MonthlyCostPoint, ProviderCost } from "./types";

// Dev-only visual preview toggle -- lets you see the Infra Cost card fully
// populated (including service/project breakdowns) without real cloud
// credentials. Never enable this in a real deployment; it returns made-up
// numbers, not actual spend. Randomized (rather than fixed) so a refresh
// actually shows the card responding to "new" data instead of the same
// static screenshot every time.

/** Splits `total` into `weights.length` positive parts, roughly proportional to `weights`. */
function distribute(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => Math.round((w / sum) * total));
}

function randomWeights(count: number): number[] {
  return Array.from({ length: count }, () => 0.3 + Math.random());
}

/** 6 months trending up toward `currentAmount` (this month), like real spend ramping up. */
function randomHistory(currentAmount: number): MonthlyCostPoint[] {
  const months = lastMonthKeys(6);
  return months.map((month, i) => {
    const progress = (i + 1) / months.length; // 0.17 .. 1.0
    const noise = 0.85 + Math.random() * 0.3;
    return { month, amount: Math.round(currentAmount * progress * noise) };
  });
}

const SERVICE_NAMES: Record<string, string[]> = {
  aws: ["EC2", "S3", "RDS", "Lambda", "CloudFront", "Data Transfer"],
  gcp: ["Compute Engine", "BigQuery", "Cloud Storage", "Cloud Run", "Networking"],
  azure: ["Virtual Machines", "Storage", "App Service", "SQL Database", "Bandwidth"],
  scaleway: ["Observability", "Compute", "Data & Analytics", "Network", "Storage", "Managed Databases"],
};

const PROJECT_NAMES: Record<string, string[]> = {
  aws: ["prod-account", "staging-account"],
  gcp: ["observex-prod", "observex-staging", "observex-sandbox"],
  azure: ["prod-rg", "shared-services-rg"],
  scaleway: ["production", "staging"],
};

function randomPreviewCosts(): ProviderCost[] {
  const ranges: Record<string, [number, number]> = {
    aws: [1500, 5000],
    gcp: [800, 3000],
    azure: [1000, 4000],
    scaleway: [200, 1500],
  };
  const labels: Record<string, string> = { aws: "AWS", gcp: "GCP", azure: "Azure", scaleway: "Scaleway" };

  return (Object.keys(ranges) as (keyof typeof ranges)[]).map((provider) => {
    const [min, max] = ranges[provider];
    const amount = Math.round(min + Math.random() * (max - min));

    const serviceNames = SERVICE_NAMES[provider];
    const services: CostBreakdownItem[] = serviceNames
      .map((name, i) => ({ name, amount: distribute(amount, randomWeights(serviceNames.length))[i] }))
      .sort((a, b) => b.amount - a.amount);

    const projectNames = PROJECT_NAMES[provider];
    const projectAmounts = distribute(amount, randomWeights(projectNames.length));
    const projects: CostBreakdownItem[] = projectNames
      .map((name, i) => ({ name, amount: projectAmounts[i] }))
      .sort((a, b) => b.amount - a.amount);

    return {
      provider: provider as ProviderCost["provider"],
      label: labels[provider],
      status: "connected",
      amount,
      currency: "USD",
      services,
      projects,
      history: randomHistory(amount),
    };
  });
}

export async function getAllProviderCosts(): Promise<ProviderCost[]> {
  if (process.env.COSTS_MOCK_PREVIEW === "1") return randomPreviewCosts();

  const results = await Promise.allSettled([getAwsCost(), getGcpCost(), getAzureCost(), getScalewayCost()]);
  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    const labels = ["AWS", "GCP", "Azure", "Scaleway"] as const;
    const providers = ["aws", "gcp", "azure", "scaleway"] as const;
    return {
      provider: providers[i],
      label: labels[i],
      status: "error",
      detail: r.reason instanceof Error ? r.reason.message : "Unexpected error.",
    };
  });
}

export type { ProviderCost, CloudProvider, ProviderCostStatus, CostBreakdownItem } from "./types";
