import { NextRequest } from "next/server";
import { platformAdminServiceUrl } from "@/lib/serverFetch";
import { proxyToPlatformBackend } from "@/lib/adminProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return proxyToPlatformBackend(req, platformAdminServiceUrl(), "/tenants");
}
