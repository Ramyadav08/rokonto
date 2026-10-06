-- Adds: a 4th tenant-user role (developer), a genuinely separate
-- platform-staff identity (not a tenant user at all -- see platform_admins),
-- a minimal support ticket system connecting the two, and the registry
-- table behind blackbox/synthetic URL checks.

ALTER TYPE user_role ADD VALUE 'developer';

-- Platform staff (the internal "manage our clients" side) are deliberately
-- not rows in `users` -- they don't belong to any tenant, and mixing the two
-- identity spaces would make it too easy for a bug to let a tenant admin
-- reach cross-tenant data. Entirely separate table, entirely separate auth.
CREATE TABLE platform_admins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE ticket_status AS ENUM ('open', 'pending', 'resolved', 'closed');
CREATE TYPE ticket_priority AS ENUM ('low', 'normal', 'high', 'urgent');

CREATE TABLE support_tickets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject         TEXT NOT NULL,
    description     TEXT NOT NULL,
    status          ticket_status NOT NULL DEFAULT 'open',
    priority        ticket_priority NOT NULL DEFAULT 'normal',
    assigned_to     UUID REFERENCES platform_admins(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A comment's author is either a tenant user or a platform admin, never
-- both -- enforced by the check constraint rather than two nullable FKs
-- silently both being set.
CREATE TABLE support_ticket_comments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id           UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    author_user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    author_platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL,
    body                TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT one_author CHECK (
        (author_user_id IS NOT NULL)::int + (author_platform_admin_id IS NOT NULL)::int = 1
    )
);

CREATE INDEX idx_support_tickets_tenant ON support_tickets(tenant_id);
CREATE INDEX idx_ticket_comments_ticket ON support_ticket_comments(ticket_id);

-- Blackbox/synthetic URL checks: what to probe, not the probe results
-- themselves -- results are pushed as real Prometheus metrics
-- (probe_success, probe_duration_seconds) through the existing metrics
-- pipeline, scoped by tenant_id the same way cluster-sourced metrics are,
-- so they show up in the same query-gateway/RBAC path rather than needing
-- a parallel one.
CREATE TABLE synthetic_checks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    url             TEXT NOT NULL,
    interval_seconds INTEGER NOT NULL DEFAULT 60,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);

CREATE INDEX idx_synthetic_checks_tenant ON synthetic_checks(tenant_id);
