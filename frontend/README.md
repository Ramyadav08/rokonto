# Observex frontend

Next.js 14 (App Router, TypeScript, Tailwind) UI: Overview, Dashboards,
Explore (Metrics/Logs/Traces), Alerts, and an Admin section (cluster
registration, user + RBAC management).

Talks only to its own `/api/*` Route Handlers, which proxy to the Go backend
in `../backend` (auth-service, tenant-service, rbac-service, query-gateway) —
the browser never calls a backend service directly. See `../README.md` for
the overall architecture and `../backend/README.md` for the backend API.

## Running

```bash
npm install
npm run dev
```

Requires the backend stack to be running (see `../backend/README.md`) and
`AUTH_SERVICE_URL` / `TENANT_SERVICE_URL` / `RBAC_SERVICE_URL` /
`QUERY_GATEWAY_URL` set in `.env.local` if they're not on the defaults
(`localhost:8081`/`8082`/`8083`/`8085`).
