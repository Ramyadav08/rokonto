import { NextRequest } from "next/server";
import { supportServiceUrl } from "@/lib/serverFetch";
import { proxyToPlatformBackend } from "@/lib/adminProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return proxyToPlatformBackend(req, supportServiceUrl(), `/platform/tickets/${params.id}`);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.text();
  return proxyToPlatformBackend(req, supportServiceUrl(), `/platform/tickets/${params.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
