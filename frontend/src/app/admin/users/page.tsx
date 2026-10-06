"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, KeyRound, Loader2 } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { AccessEditor } from "./AccessEditor";

interface User {
  id: string;
  email: string;
  role: "admin" | "editor" | "viewer" | "developer";
  createdAt: string;
}

type ListState = { status: "loading" } | { status: "error"; detail: string } | { status: "loaded"; users: User[] };

export default function UsersPage() {
  const [state, setState] = useState<ListState>({ status: "loading" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "viewer" | "developer">("viewer");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  function load() {
    setState({ status: "loading" });
    fetch("/api/admin/users")
      .then(async (r) => {
        if (!r.ok) {
          const payload = await r.json().catch(() => ({}));
          throw new Error(payload.error ?? `Request failed (${r.status})`);
        }
        return r.json();
      })
      .then((users: User[]) => setState({ status: "loaded", users }))
      .catch((err) => setState({ status: "error", detail: err instanceof Error ? err.message : "Request failed." }));
  }

  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setFormError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(payload.error ?? `Could not create user (${res.status}).`);
        return;
      }
      setEmail("");
      setPassword("");
      load();
    } catch {
      setFormError("Could not reach the server.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 gap-4 p-6">
      <div className="min-w-0 flex-1 space-y-4 overflow-y-auto">
        <Card>
          <CardHeader>
            <CardTitle>New user</CardTitle>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs text-text-muted" htmlFor="user-email">
                  Email
                </label>
                <input
                  id="user-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent-blue"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-muted" htmlFor="user-password">
                  Password
                </label>
                <input
                  id="user-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent-blue"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-muted" htmlFor="user-role">
                  Role
                </label>
                <Select
                  id="user-role"
                  options={[
                    { label: "viewer", value: "viewer" },
                    { label: "developer", value: "developer" },
                    { label: "editor", value: "editor" },
                    { label: "admin", value: "admin" },
                  ]}
                  value={role}
                  onChange={(e) => setRole(e.target.value as "admin" | "editor" | "viewer" | "developer")}
                />
              </div>
              <Button type="submit" variant="primary" disabled={creating}>
                {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create user
              </Button>
            </form>
            {formError && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-status-critical">
                <AlertTriangle className="h-3.5 w-3.5" />
                {formError}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
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
            ) : state.users.length === 0 ? (
              <div className="p-4 text-sm text-text-muted">No users yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-text-muted">
                    <th className="px-4 py-2 font-normal">Email</th>
                    <th className="px-4 py-2 font-normal">Role</th>
                    <th className="px-4 py-2 font-normal">Created</th>
                    <th className="px-4 py-2 font-normal" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {state.users.map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-2 text-text-primary">{u.email}</td>
                      <td className="px-4 py-2 text-text-secondary">{u.role}</td>
                      <td className="px-4 py-2 text-text-secondary">{new Date(u.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">
                        <Button variant="secondary" onClick={() => setEditingUser(u)}>
                          <KeyRound className="h-3.5 w-3.5" />
                          Access
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      </div>

      {editingUser && (
        <AccessEditor userId={editingUser.id} userEmail={editingUser.email} onClose={() => setEditingUser(null)} />
      )}
    </div>
  );
}
