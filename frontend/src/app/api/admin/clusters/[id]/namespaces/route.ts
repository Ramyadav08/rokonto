import { NextRequest } from "next/server";
import { tenantServiceUrl } from "@/lib/serverFetch";
import { proxyToBackend } from "@/lib/adminProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return proxyToBackend(req, tenantServiceUrl(), `/clusters/${encodeURIComponent(params.id)}/namespaces`);
}
