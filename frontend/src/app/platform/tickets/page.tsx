"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface Ticket {
  id: string;
  tenantId: string;
  tenantName: string;
  createdBy: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

type ListState = { status: "loading" } | { status: "error"; detail: string } | { status: "loaded"; tickets: Ticket[] };

const STATUS_OPTIONS = [
  { label: "All", value: "" },
  { label: "Open", value: "open" },
  { label: "Pending", value: "pending" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
];

export default function PlatformTicketsPage() {
  const [state, setState] = useState<ListState>({ status: "loading" });
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    setState({ status: "loading" });
    const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
    fetch(`/api/platform/tickets${query}`)
      .then(async (r) => {
        if (!r.ok) {
          const payload = await r.json().catch(() => ({}));
          throw new Error(payload.error ?? `Request failed (${r.status})`);
        }
        return r.json();
      })
      .then((tickets: Ticket[]) => setState({ status: "loaded", tickets }))
      .catch((err) => setState({ status: "error", detail: err instanceof Error ? err.message : "Request failed." }));
  }, [statusFilter]);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Support Tickets</CardTitle>
          <Select
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          />
        </CardHeader>
        <CardBody className="!p-0">
          {state.status === "loading" ? (
            <div className="flex items-center gap-1.5 p-4 text-sm text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : state.status === "error" ? (
            <div className="flex items-center gap-1.5 p-4 text-sm text-status-critical">
              <AlertTriangle className="h-4 w-4" />
              {state.detail}
            </div>
          ) : state.tickets.length === 0 ? (
            <div className="p-4 text-sm text-text-muted">No tickets yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-text-muted">
                  <th className="px-4 py-2 font-normal">Subject</th>
                  <th className="px-4 py-2 font-normal">Client</th>
                  <th className="px-4 py-2 font-normal">Status</th>
                  <th className="px-4 py-2 font-normal">Priority</th>
                  <th className="px-4 py-2 font-normal">Assigned to</th>
                  <th className="px-4 py-2 font-normal">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {state.tickets.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-2">
                      <Link href={`/platform/tickets/${t.id}`} className="text-accent-blue hover:underline">
                        {t.subject}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-text-secondary">{t.tenantName}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-2 text-text-secondary">{t.priority}</td>
                    <td className="px-4 py-2 text-text-secondary">{t.assignedTo ?? "unassigned"}</td>
                    <td className="px-4 py-2 text-text-secondary">{new Date(t.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
