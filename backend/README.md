# Observex backend

Multi-tenant observability platform backend: Go microservices in front of
Grafana Mimir (metrics), Loki (logs), and Tempo (traces) -- all three natively
multi-tenant via `X-Scope-OrgID`, which is what actually keeps different
clients' data apart. See `/Users/ramrekhayadav/.claude/plans/abstract-tinkering-gizmo.md`
for the full architecture writeup.

## Services

| Service | Port | Purpose |
|---|---|---|
| `auth-service` | 8081 | login/logout, issues session JWTs |
| `tenant-service` | 8082 | CRUD for clusters + namespaces within the caller's tenant |
| `rbac-service` | 8083 | CRUD for users + their per-cluster/namespace access grants |
| `ingest-gateway` | 8084 | the only endpoint client-cluster agents talk to (metrics/logs/traces write path) |
| `query-gateway` | 8085 | the only endpoint the frontend talks to (metrics/logs/traces/alerts read path, RBAC-enforced) |

Shared code lives in `internal/`: `db` (Postgres pool + migration runner),
`auth` (JWT + password/agent-token hashing), `tenancy` (the PromQL/LogQL/
TraceQL scoping that enforces RBAC on every query), `httpx` (JSON helpers).

## Running it

**Nothing has been started yet.** This has been built and verified with
`go build ./...` / `go vet ./...` / `go test ./...` only -- no service, and
no docker container, has been run.

To bring it up:

```sh
cp .env.example .env   # fill in ADMIN_PASSWORD, JWT_SECRET, INTERNAL_API_KEY
docker compose up --build
```

First boot runs `migrations/*.sql`, then seeds tenant "alyssum" with one dev
cluster and an admin user (`admin@alyssum.example`, whatever password you
set). The cluster's agent token is printed once to the `seed` container's
logs (`docker compose logs seed`) -- save it, it's needed to point a real
cluster's agent (`deploy/cluster-agent/`, a Helm chart wrapping Grafana
Alloy) at `ingest-gateway`.

## Query-gateway API (what the frontend calls)

Every route below requires a session -- either the `observex_session` httpOnly
cookie (set by `POST /login` on auth-service) or an `Authorization: Bearer
<token>` header.

- `GET /clusters` -- clusters the caller can see, with `fullAccess: bool`.
- `GET /metrics/query_range?query=<promql>&range=<start>&end=<end>&step=<step>` -- proxies Mimir, raw response.
- `GET /metrics/query?query=<promql>` -- instant query.
- `GET /metrics/label_values?label=<name>&metric=<optional selector>` -- proxies Mimir label-values, scoped to the caller's clusters.
- `GET /logs/query_range?query=<logql>&...` -- proxies Loki.
- `GET /traces/search?q=<traceql>&...` -- proxies Tempo search.
- `GET /traces/{traceID}` -- a single trace by ID (tenant-isolated via OrgID only, not further cluster-scoped).
- `GET /alerts` -- proxies Mimir's built-in Alertmanager, filtered to the caller's clusters/namespaces.

Every query parameter above gets its label matchers rewritten server-side
(`internal/tenancy`) to intersect with the caller's resolved `access_grants`
before it ever reaches Mimir/Loki/Tempo -- a request can only ever see less
than what it asked for, never more.
