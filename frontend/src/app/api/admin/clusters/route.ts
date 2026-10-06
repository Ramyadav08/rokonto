import { NextRequest } from "next/server";
import { tenantServiceUrl } from "@/lib/serverFetch";
import { proxyToBackend } from "@/lib/adminProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return proxyToBackend(req, tenantServiceUrl(), "/clusters");
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  return proxyToBackend(req, tenantServiceUrl(), "/clusters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
