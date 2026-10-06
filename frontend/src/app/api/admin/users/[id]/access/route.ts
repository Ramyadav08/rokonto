import { NextRequest } from "next/server";
import { rbacServiceUrl } from "@/lib/serverFetch";
import { proxyToBackend } from "@/lib/adminProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return proxyToBackend(req, rbacServiceUrl(), `/users/${encodeURIComponent(params.id)}/access`);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.text();
  return proxyToBackend(req, rbacServiceUrl(), `/users/${encodeURIComponent(params.id)}/access`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
