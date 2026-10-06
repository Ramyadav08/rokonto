import { NextRequest } from "next/server";
import { blackboxServiceUrl } from "@/lib/serverFetch";
import { proxyToBackend } from "@/lib/adminProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return proxyToBackend(req, blackboxServiceUrl(), `/checks/${encodeURIComponent(params.id)}`, { method: "DELETE" });
}
