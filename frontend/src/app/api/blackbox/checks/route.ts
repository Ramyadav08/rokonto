import { NextRequest } from "next/server";
import { blackboxServiceUrl } from "@/lib/serverFetch";
import { proxyToBackend } from "@/lib/adminProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return proxyToBackend(req, blackboxServiceUrl(), "/checks");
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  return proxyToBackend(req, blackboxServiceUrl(), "/checks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
