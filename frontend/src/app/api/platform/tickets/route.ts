import { NextRequest } from "next/server";
import { supportServiceUrl } from "@/lib/serverFetch";
import { proxyToPlatformBackend } from "@/lib/adminProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const path = status ? `/platform/tickets?status=${encodeURIComponent(status)}` : "/platform/tickets";
  return proxyToPlatformBackend(req, supportServiceUrl(), path);
}
