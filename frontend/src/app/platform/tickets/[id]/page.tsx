"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/cn";

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  authorType: "user" | "platform_admin";
  authorEmail: string;
}

interface TicketDetail {
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
  comments: Comment[];
}

type DetailState = { status: "loading" } | { status: "error"; detail: string } | { status: "loaded"; ticket: TicketDetail };

const STATUS_OPTIONS = [
  { label: "Open", value: "open" },
  { label: "Pending", value: "pending" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
];

const PRIORITY_OPTIONS = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

export default function PlatformTicketDetailPage() {
  const params = useParams<{ id: string }>();
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [commentBody, setCommentBody] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [patchError, setPatchError] = useState<string | null>(null);
  const [assigneeDraft, setAssigneeDraft] = useState("");
  const [savingAssignee, setSavingAssignee] = useState(false);
  const [admins, setAdmins] = useState<{ id: string; email: string }[]>([]);

  useEffect(() => {
    fetch("/api/platform/admins")
      .then((r) => (r.ok ? r.json() : []))
      .then(setAdmins)
      .catch(() => setAdmins([]));
  }, []);

  function load() {
    setState({ status: "loading" });
    fetch(`/api/platform/tickets/${params.id}`)
      .then(async (r) => {
        if (!r.ok) {
          const payload = await r.json().catch(() => ({}));
          throw new Error(payload.error ?? `Request failed (${r.status})`);
        }
        return r.json();
      })
      .then((ticket: TicketDetail) => {
        setState({ status: "loaded", ticket });
        setAssigneeDraft(ticket.assignedTo ?? "");
      })
      .catch((err) => setState({ status: "error", detail: err instanceof Error ? err.message : "Request failed." }));
  }

  useEffect(load, [params.id]);

  async function patch(fields: Partial<Pick<TicketDetail, "status" | "priority" | "assignedTo">>) {
    setPatchError(null);
    try {
      const res = await fetch(`/api/platform/tickets/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPatchError(payload.error ?? `Could not update ticket (${res.status}).`);
        return;
      }
      load();
    } catch {
      setPatchError("Could not reach the server.");
    }
  }

  async function handleAssigneeChange(value: string) {
    setSavingAssignee(true);
    await patch({ assignedTo: value || null });
    setSavingAssignee(false);
  }

  async function handleCommentSubmit(e: FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setPostingComment(true);
    setCommentError(null);
    try {
      const res = await fetch(`/api/platform/tickets/${params.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentBody }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCommentError(payload.error ?? `Could not post comment (${res.status}).`);
        return;
      }
      setCommentBody("");
      load();
    } catch {
      setCommentError("Could not reach the server.");
    } finally {
      setPostingComment(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <Link href="/platform/tickets" className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to tickets
      </Link>

      {state.status === "loading" ? (
        <div className="flex items-center gap-1.5 p-4 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : state.status === "error" ? (
        <div className="flex items-center gap-1.5 rounded-md border border-status-critical/30 bg-status-critical/10 p-4 text-sm text-status-critical">
          <AlertTriangle className="h-4 w-4" />
          {state.detail}
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{state.ticket.subject}</CardTitle>
              <StatusBadge status={state.ticket.status} />
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="whitespace-pre-wrap text-sm text-text-secondary">{state.ticket.description}</p>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
                <span>Client: {state.ticket.tenantName}</span>
                <span>·</span>
                <span>Reported by: {state.ticket.createdBy}</span>
                <span>·</span>
                <span>Created: {new Date(state.ticket.createdAt).toLocaleString()}</span>
              </div>

              <div className="flex flex-wrap items-end gap-4 border-t border-border pt-3">
                <div>
                  <label className="mb-1 block text-xs text-text-muted" htmlFor="ticket-status">
                    Status
                  </label>
                  <Select
                    id="ticket-status"
                    options={STATUS_OPTIONS}
                    value={state.ticket.status}
                    onChange={(e) => patch({ status: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-muted" htmlFor="ticket-priority">
                    Priority
                  </label>
                  <Select
                    id="ticket-priority"
                    options={PRIORITY_OPTIONS}
                    value={state.ticket.priority}
                    onChange={(e) => patch({ priority: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-muted" htmlFor="ticket-assignee">
                    Assigned to
                  </label>
                  <Select
                    id="ticket-assignee"
                    options={[
                      { label: "Unassigned", value: "" },
                      ...admins.map((a) => ({ label: a.email, value: a.id })),
                    ]}
                    value={assigneeDraft}
                    disabled={savingAssignee}
                    onChange={(e) => {
                      setAssigneeDraft(e.target.value);
                      handleAssigneeChange(e.target.value);
                    }}
                  />
                </div>
              </div>
              {patchError && (
                <div className="flex items-center gap-1.5 text-xs text-status-critical">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {patchError}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comments</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {state.ticket.comments.length === 0 ? (
                <div className="text-sm text-text-muted">No comments yet.</div>
              ) : (
                <div className="space-y-2">
                  {state.ticket.comments.map((c) => (
                    <div
                      key={c.id}
                      className={cn(
                        "max-w-[85%] rounded-md border px-3 py-2 text-sm",
                        c.authorType === "platform_admin"
                          ? "ml-auto border-accent-blue/30 bg-accent-blue/10"
                          : "mr-auto border-border bg-surface-raised"
                      )}
                    >
                      <div className="mb-1 flex items-center gap-1.5 text-xs text-text-muted">
                        <span className="font-medium text-text-secondary">{c.authorEmail}</span>
                        <span
                          className={cn(
                            "rounded border px-1 py-0.5 text-[10px] uppercase",
                            c.authorType === "platform_admin"
                              ? "border-accent-blue/30 text-accent-blue"
                              : "border-border text-text-muted"
                          )}
                        >
                          {c.authorType === "platform_admin" ? "Staff" : "Client"}
                        </span>
                        <span>{new Date(c.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-text-primary">{c.body}</p>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleCommentSubmit} className="space-y-2 border-t border-border pt-3">
                <textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Reply to this ticket…"
                  rows={3}
                  className="w-full resize-none rounded-md border border-border bg-surface-raised px-2.5 py-2 text-sm text-text-primary outline-none focus:border-accent-blue"
                />
                {commentError && (
                  <div className="flex items-center gap-1.5 text-xs text-status-critical">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {commentError}
                  </div>
                )}
                <Button type="submit" variant="primary" disabled={postingComment || !commentBody.trim()}>
                  {postingComment && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Post comment
                </Button>
              </form>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
