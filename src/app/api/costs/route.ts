import { NextResponse } from "next/server";
import { getAllProviderCosts } from "@/lib/costs";

// Calls real provider billing APIs server-side (credentials never reach the
// client); runs on the Node runtime since the AWS/BigQuery SDKs need it,
// and is never statically cached since spend changes constantly.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const costs = await getAllProviderCosts();
  return NextResponse.json({ costs, fetchedAt: new Date().toISOString() });
}
