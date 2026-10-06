import { NextRequest } from "next/server";
import { rbacServiceUrl } from "@/lib/serverFetch";
import { proxyToBackend } from "@/lib/adminProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return proxyToBackend(req, rbacServiceUrl(), "/users");
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  return proxyToBackend(req, rbacServiceUrl(), "/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
