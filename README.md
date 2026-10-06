# Observex

Multi-tenant Kubernetes observability platform: metrics, logs, traces,
dashboards, and alerts across many clients' clusters (dev/stg/prod), with
per-user RBAC down to the cluster/namespace level.

```
/frontend   Next.js UI -- see frontend/README.md
/backend    Go microservices + Mimir/Loki/Tempo/Postgres -- see backend/README.md
```

The frontend never talks to a storage backend (Mimir/Loki/Tempo/Postgres)
directly -- everything goes through the Go services in `/backend`, which are
what actually enforce tenant isolation and RBAC on every read and write.

See `/Users/ramrekhayadav/.claude/plans/abstract-tinkering-gizmo.md` for the
full architecture writeup this was built from.

## Status

Backend: all 5 services + shared packages code-complete, `go build`/`go
vet`/`go test` passing. Frontend: auth, admin (clusters/users/RBAC), and the
metrics/alerts data path wired to the backend; logs, traces, dashboard
persistence, and some Overview widgets are still on the older mock-data path
-- see recent commit history / conversation notes for the exact cut line.

**Nothing has been run yet** -- no `docker compose up`, no live database.
Everything so far is static verification only (compiles, type-checks, unit
tests). See `backend/README.md` for how to bring the stack up when ready.
