-- Control-plane schema: tenants, clusters, namespaces, users, roles, access grants.
-- This is the isolation anchor for the whole platform -- every other service
-- (ingest-gateway, query-gateway) keys its multi-tenancy enforcement off
-- tenant_id / cluster_id / namespace_id defined here.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE cluster_env AS ENUM ('dev', 'stg', 'prod');

CREATE TABLE clusters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    env             cluster_env NOT NULL,
    -- Bcrypt hash of the per-cluster agent token. The plaintext token is
    -- shown once at creation time and never stored -- a leaked token only
    -- ever exposes the one cluster it was issued for, never the tenant.
    agent_token_hash TEXT NOT NULL,
    last_seen_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);

-- Populated by each cluster's agent reporting what namespaces it actually
-- sees -- not user-entered, so it can't drift from reality.
CREATE TABLE namespaces (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id  UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (cluster_id, name)
);

CREATE TYPE user_role AS ENUM ('admin', 'editor', 'viewer');

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    password_hash   TEXT NOT NULL,
    role            user_role NOT NULL DEFAULT 'viewer',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, email)
);

-- namespace_id NULL means "every namespace in this cluster". A row's mere
-- existence is the grant -- there is no separate enable/disable flag, so
-- revoking access is just deleting the row.
CREATE TABLE access_grants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cluster_id      UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    namespace_id    UUID REFERENCES namespaces(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, cluster_id, namespace_id)
);

CREATE INDEX idx_clusters_tenant ON clusters(tenant_id);
CREATE INDEX idx_namespaces_cluster ON namespaces(cluster_id);
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_access_grants_user ON access_grants(user_id);
