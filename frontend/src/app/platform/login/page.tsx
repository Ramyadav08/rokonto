"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

function PlatformLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error ?? "Could not sign in.");
        setSubmitting(false);
        return;
      }
      const next = searchParams.get("next");
      router.push(next && next.startsWith("/platform") ? next : "/platform/tenants");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-dvh w-full items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardBody className="space-y-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-accent-blue" strokeWidth={2.25} />
            <div>
              <span className="block text-sm font-semibold tracking-tight text-text-primary">Observex Internal</span>
              <span className="block text-xs text-text-muted">Platform admin</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-text-muted" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-raised px-2.5 py-2 text-sm text-text-primary outline-none focus:border-accent-blue"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-raised px-2.5 py-2 text-sm text-text-primary outline-none focus:border-accent-blue"
              />
            </div>

            {error && (
              <div className="flex items-start gap-1.5 rounded-md border border-status-critical/30 bg-status-critical/10 px-2.5 py-2 text-xs text-status-critical">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" variant="primary" size="md" disabled={submitting} className="w-full justify-center">
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

export default function PlatformLoginPage() {
  return (
    <Suspense fallback={null}>
      <PlatformLoginForm />
    </Suspense>
  );
}
