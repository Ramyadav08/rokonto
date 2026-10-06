import { NextRequest } from "next/server";
import { supportServiceUrl } from "@/lib/serverFetch";
import { proxyToPlatformBackend } from "@/lib/adminProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.text();
  return proxyToPlatformBackend(req, supportServiceUrl(), `/platform/tickets/${params.id}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
