import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  HeartPulse,
  Layers,
  LayoutGrid,
  Link2,
  ShieldCheck,
} from "lucide-react";

const FEATURES = [
  {
    icon: Layers,
    title: "Unified observability",
    description: "Metrics, logs, and traces for every cluster in one query layer, correlated instead of siloed across three different tools.",
  },
  {
    icon: ShieldCheck,
    title: "Multi-tenant RBAC",
    description: "Admin, editor, viewer, and developer roles scoped per cluster and per namespace, enforced at the query layer, not the UI.",
  },
  {
    icon: Link2,
    title: "Cluster onboarding in minutes",
    description: "Create a cluster, copy one Helm command, and watch it go green the moment the agent starts reporting.",
  },
  {
    icon: HeartPulse,
    title: "Blackbox monitoring",
    description: "Track uptime and latency for any external URL alongside your in-cluster telemetry, no separate tool required.",
  },
  {
    icon: Bell,
    title: "Real-time alerting",
    description: "Live alert status surfaced on every dashboard, with a ranked top-15 view built for on-call triage.",
  },
  {
    icon: LayoutGrid,
    title: "Drag-and-drop access control",
    description: "Grant a teammate full-cluster access by default, then restrict them to specific namespaces by dragging, not checking boxes.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-background text-text-primary">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-accent-blue" strokeWidth={2.25} />
            <span className="text-sm font-semibold tracking-tight">Observex</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-text-secondary sm:flex">
            <a href="#features" className="hover:text-text-primary">
              Features
            </a>
            <a href="#platform" className="hover:text-text-primary">
              Platform
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-text-secondary hover:text-text-primary">
              Log in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-md bg-accent-blue px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
            >
              Start free
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden px-6 pb-20 pt-20 sm:pt-28">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 h-[560px] w-[1100px] -translate-x-1/2 rounded-full bg-accent-blue/10 blur-[120px]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-40 h-[400px] w-[700px] -translate-x-1/3 rounded-full bg-accent-purple/10 blur-[110px]"
          />

          <div className="relative mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-5 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-status-healthy" />
              Kubernetes &amp; cloud observability
            </div>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              See inside every cluster, every namespace, every team.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-balance text-base text-text-secondary sm:text-lg">
              Observex unifies metrics, logs, traces, alerts, and uptime checks across every
              Kubernetes cluster you run — with per-namespace access control built in from day one.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-1.5 rounded-md bg-accent-blue px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
              >
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#platform"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover"
              >
                See the platform
              </a>
            </div>
          </div>

          <div className="relative mx-auto mt-16 max-w-4xl [perspective:1800px]">
            <div className="rounded-xl border border-border bg-surface shadow-[0_40px_90px_-20px_rgba(0,0,0,0.6)] [transform:rotateX(6deg)_rotateY(-2deg)]">
              <DashboardMockup />
            </div>
          </div>
        </section>

        <section className="border-t border-border px-6 py-10">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-xs uppercase tracking-wide text-text-muted">
              Speaks PromQL, LogQL, and TraceQL — compatible with the stack you already run
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-text-secondary">
              <span>Kubernetes</span>
              <span>Prometheus</span>
              <span>Loki</span>
              <span>Tempo</span>
              <span>Grafana-compatible dashboards</span>
              <span>AWS / GCP / Azure</span>
            </div>
          </div>
        </section>

        <section id="features" className="border-t border-border px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <div className="mx-auto max-w-xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Everything an SRE team needs, nothing it doesn&apos;t
              </h2>
              <p className="mt-3 text-sm text-text-secondary sm:text-base">
                Built as independent microservices behind one query layer, so each capability
                scales and fails independently.
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="rounded-lg border border-border bg-surface p-5">
                  <feature.icon className="h-5 w-5 text-accent-blue" strokeWidth={2} />
                  <h3 className="mt-3 text-sm font-medium text-text-primary">{feature.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="platform" className="border-t border-border px-6 py-20">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-10 lg:flex-row">
            <div className="flex-1">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                One platform, isolated per tenant
              </h2>
              <p className="mt-3 text-sm text-text-secondary sm:text-base">
                Every client gets their own tenant, their own clusters, and their own users —
                enforced at the query layer so one team&apos;s data can never leak into another&apos;s
                dashboard.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-text-secondary">
                <li className="flex items-start gap-2.5">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-blue" />
                  Four roles — admin, editor, viewer, developer — scoped per cluster and namespace.
                </li>
                <li className="flex items-start gap-2.5">
                  <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-blue" />
                  Connect a cluster with one Helm command and a scoped agent token.
                </li>
                <li className="flex items-start gap-2.5">
                  <Bell className="mt-0.5 h-4 w-4 shrink-0 text-accent-blue" />
                  Live alerts and uptime checks surfaced the moment they fire.
                </li>
              </ul>
            </div>
            <div className="w-full flex-1 rounded-lg border border-border bg-surface p-5">
              <div className="mb-3 flex items-center gap-1.5 text-xs text-text-muted">
                <AlertTriangle className="h-3.5 w-3.5 text-status-warning" />
                Top alerts
              </div>
              <div className="space-y-2">
                {[
                  { label: "HighMemoryUsage · payments-api", tone: "critical" as const },
                  { label: "PodCrashLooping · checkout-worker", tone: "critical" as const },
                  { label: "LatencyBudgetBurn · edge-gateway", tone: "warning" as const },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-xs"
                  >
                    <span className="text-text-secondary">{row.label}</span>
                    <span
                      className={
                        row.tone === "critical"
                          ? "rounded border border-status-critical/30 bg-status-critical/15 px-1.5 py-0.5 text-status-critical"
                          : "rounded border border-status-warning/30 bg-status-warning/15 px-1.5 py-0.5 text-status-warning"
                      }
                    >
                      Firing
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border px-6 py-20">
          <div className="mx-auto max-w-2xl rounded-xl border border-border bg-surface px-8 py-12 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Ready to see inside your clusters?
            </h2>
            <p className="mt-3 text-sm text-text-secondary sm:text-base">
              Create a tenant, connect your first cluster, and start querying real data in minutes.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-1.5 rounded-md bg-accent-blue px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
              >
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-raised px-5 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover"
              >
                Log in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-text-muted sm:flex-row">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-text-muted" strokeWidth={2.25} />
            <span>Observex</span>
          </div>
          <span>© {new Date().getFullYear()} Observex. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}

/** Static, illustrative preview of the real Overview dashboard -- not wired
    to any datasource. It exists purely to show an unauthenticated visitor
    what the product looks like, same role as a marketing screenshot. */
function DashboardMockup() {
  const kpis = [
    { label: "Nodes Healthy", value: "12/12", tone: "text-status-healthy" },
    { label: "Pods Running", value: "348", tone: "text-text-primary" },
    { label: "Active Alerts", value: "2 firing", tone: "text-status-critical" },
    { label: "Uptime", value: "99.98%", tone: "text-status-healthy" },
  ];

  return (
    <div className="p-5 sm:p-7">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="h-2 w-2 rounded-full bg-status-critical/70" />
          <span className="h-2 w-2 rounded-full bg-status-warning/70" />
          <span className="h-2 w-2 rounded-full bg-status-healthy/70" />
          <span className="ml-2">observex.io/overview</span>
        </div>
        <div className="rounded-md border border-border bg-surface-raised px-2.5 py-1 text-[11px] text-text-secondary">
          dev-001 ▾
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-md border border-border bg-surface-raised p-3">
            <div className="text-[11px] text-text-muted">{kpi.label}</div>
            <div className={`mt-1 text-base font-semibold tabular-nums ${kpi.tone}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
        <div className="col-span-2 rounded-md border border-border bg-surface-raised p-3">
          <div className="mb-2 text-[11px] text-text-muted">Request rate</div>
          <svg viewBox="0 0 300 80" className="h-20 w-full" preserveAspectRatio="none">
            <polyline
              points="0,60 30,55 60,58 90,40 120,45 150,20 180,30 210,25 240,15 270,22 300,10"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
            />
            <polyline
              points="0,60 30,55 60,58 90,40 120,45 150,20 180,30 210,25 240,15 270,22 300,10 300,80 0,80"
              fill="#3b82f6"
              fillOpacity="0.08"
              stroke="none"
            />
          </svg>
        </div>
        <div className="rounded-md border border-border bg-surface-raised p-3">
          <div className="mb-2 text-[11px] text-text-muted">Recent problems</div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-status-critical" />
              checkout-worker OOMKilled
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-status-warning" />
              edge-gateway p99 high
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-status-healthy" />
              payments-api recovered
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
