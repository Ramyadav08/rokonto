export type CloudProvider = "aws" | "gcp" | "azure" | "scaleway";

export type ProviderCostStatus = "connected" | "not_configured" | "error";

export interface CostBreakdownItem {
  name: string;
  amount: number;
}

export interface MonthlyCostPoint {
  /** e.g. "2026-04" */
  month: string;
  amount: number;
}

export interface ProviderCost {
  provider: CloudProvider;
  label: string;
  status: ProviderCostStatus;
  /** Month-to-date spend, only present when status === "connected". */
  amount?: number;
  currency?: string;
  /** Human-readable reason, only present when status === "error" or to explain "not_configured". */
  detail?: string;
  /**
   * Top cost-driving services/categories within this provider (e.g. AWS
   * "EC2"/"S3", Scaleway's consumption "category"). Only present when
   * status === "connected" and the provider's API exposes it.
   */
  services?: CostBreakdownItem[];
  /**
   * Per-project (GCP projects, Scaleway projects) or nearest equivalent
   * (AWS linked accounts, Azure subscriptions) breakdown. Only present
   * when status === "connected" and there's more than one.
   */
  projects?: CostBreakdownItem[];
  /**
   * Total spend per month for the last 6 months (oldest first), for the
   * consumption trend chart. Only present when status === "connected" and
   * the provider's API supports a historical monthly query.
   */
  history?: MonthlyCostPoint[];
}
