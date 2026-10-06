import { NextRequest, NextResponse } from "next/server";
import { logInstanceValuesViaGateway, deriveLabelsFromInstance } from "@/lib/datasource/queryGateway";
import { getSessionToken } from "@/lib/serverFetch";

// Returns the complete, real set of namespace/container values seen across
// every log stream the caller can access -- not just whatever's in the most
// recently fetched window (see logInstanceValuesViaGateway for why that
// matters). Decomposes Loki's real `instance` label the same way
// /api/datasource/logs does, so the two stay consistent.
//
// An optional `namespace` param narrows `containers` to only those that
// actually exist within that namespace -- e.g. selecting "default" should
// offer only "nginx", not every container across every namespace. `instance`
// isn't a real Loki label Loki itself can filter server-side by namespace
// (namespace only exists after this decomposition), so the narrowing happens
// here, after decomposition, rather than as a Loki-side selector.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cluster = req.nextUrl.searchParams.get("cluster") ?? undefined;
  const namespaceFilter = req.nextUrl.searchParams.get("namespace");
  const instances = await logInstanceValuesViaGateway(getSessionToken(req), cluster);

  const namespaces = new Set<string>();
  const containers = new Set<string>();
  for (const instance of instances) {
    const labels = deriveLabelsFromInstance(instance);
    if (labels.namespace) namespaces.add(labels.namespace);
    if (labels.container && (!namespaceFilter || namespaceFilter === "all" || labels.namespace === namespaceFilter)) {
      containers.add(labels.container);
    }
  }

  return NextResponse.json({
    namespaces: Array.from(namespaces).sort(),
    containers: Array.from(containers).sort(),
  });
}
