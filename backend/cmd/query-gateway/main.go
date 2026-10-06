// query-gateway is the only endpoint the frontend talks to for metrics,
// logs, and traces. Every request is authenticated (internal/auth), scoped
// to the caller's tenant (X-Scope-OrgID, never client-supplied), and
// restricted to the caller's granted clusters/namespaces (internal/tenancy)
// before being proxied to Mimir, Loki, or Tempo.
package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"observex/backend/internal/auth"
	"observex/backend/internal/db"
	"observex/backend/internal/httpx"
	"observex/backend/internal/tenancy"
)

type server struct {
	pool       *pgxpool.Pool
	httpClient *http.Client
	mimirURL   string
	lokiURL    string
	tempoURL   string
}

// clusterGrant is one cluster's worth of a user's access: either full access
// (every namespace) or a specific namespace allow-list.
type clusterGrant struct {
	fullAccess bool
	namespaces []string
}

// resolvedAccess is a user's whole grant set within their own tenant, keyed
// by cluster name (not ID -- see the comment in loadAccess for why). Always
// loaded fresh from Postgres per request in this first version -- a Redis
// cache belongs here once this is proven correct.
type resolvedAccess struct {
	grants map[string]clusterGrant
}

func (s *server) loadAccess(ctx context.Context, claims *auth.Claims) (resolvedAccess, error) {
	// Admin is the tenant's superuser role -- access_grants exists to scope
	// editor/viewer/developer down to specific clusters/namespaces, not to
	// gate the admin who manages those grants in the first place. Without
	// this, every self-service signup (auth-service's handleSignup) and
	// every cluster an admin creates (tenant-service's POST /clusters) would
	// leave that admin permanently unable to query their own tenant's data,
	// since neither of those write paths inserts an access_grants row --
	// only the one-off demo seed script does.
	if claims.Role == "admin" {
		rows, err := s.pool.Query(ctx, `SELECT name FROM clusters WHERE tenant_id = $1`, claims.TenantID)
		if err != nil {
			return resolvedAccess{}, fmt.Errorf("loading tenant clusters: %w", err)
		}
		defer rows.Close()
		grants := map[string]clusterGrant{}
		for rows.Next() {
			var clusterName string
			if err := rows.Scan(&clusterName); err != nil {
				return resolvedAccess{}, fmt.Errorf("scanning cluster: %w", err)
			}
			grants[clusterName] = clusterGrant{fullAccess: true}
		}
		return resolvedAccess{grants: grants}, nil
	}

	// c.name, not c.id -- the `cluster` label every ingested series actually
	// carries is the human-readable name an agent was deployed with
	// (OBSERVEX_CLUSTER_NAME), never the database UUID. Enforcing against
	// the UUID would make every RBAC-scoped query match nothing, which is
	// exactly what happened the first time this was tested end to end
	// against a real agent. Names are only unique per tenant, not globally,
	// but that's fine here -- X-Scope-OrgID already isolates by tenant
	// before this matcher is ever applied.
	rows, err := s.pool.Query(ctx, `
		SELECT c.name, n.name
		FROM access_grants g
		JOIN clusters c ON c.id = g.cluster_id
		LEFT JOIN namespaces n ON n.id = g.namespace_id
		WHERE g.user_id = $1
	`, claims.UserID)
	if err != nil {
		return resolvedAccess{}, fmt.Errorf("loading access grants: %w", err)
	}
	defer rows.Close()

	grants := map[string]clusterGrant{}
	for rows.Next() {
		var clusterName string
		var namespace *string
		if err := rows.Scan(&clusterName, &namespace); err != nil {
			return resolvedAccess{}, fmt.Errorf("scanning access grant: %w", err)
		}
		g := grants[clusterName]
		if namespace == nil {
			g.fullAccess = true
		} else {
			g.namespaces = append(g.namespaces, *namespace)
		}
		grants[clusterName] = g
	}
	return resolvedAccess{grants: grants}, nil
}

// scopeFor turns a user's grant set into the (clusterNames, namespaces)
// pair ScopePromQL/LogQL/TraceQL/the alerts filter actually enforce.
//
// With a selected cluster (the frontend's global cluster picker), this
// resolves cleanly to that one cluster's own namespace list -- which also
// fixes a real ambiguity the "no selection" path can't: a user with
// namespace-scoped access to cluster A and full access to cluster B has no
// single correct namespace filter when both are in play at once, so the "no
// selection" path has to drop the namespace restriction entirely in that
// case (full access to B must not be narrowed by A's namespace list, and
// there's no per-cluster matcher shape to apply it correctly across both).
// Selecting one cluster removes that ambiguity outright.
func (a resolvedAccess) scopeFor(selectedCluster string) (clusterNames []string, namespaces []string, ok bool) {
	if selectedCluster != "" {
		g, exists := a.grants[selectedCluster]
		if !exists {
			return nil, nil, false
		}
		if g.fullAccess {
			return []string{selectedCluster}, nil, true
		}
		return []string{selectedCluster}, g.namespaces, true
	}

	hasAnyFullAccess := false
	for name, g := range a.grants {
		clusterNames = append(clusterNames, name)
		if g.fullAccess {
			hasAnyFullAccess = true
		} else {
			namespaces = append(namespaces, g.namespaces...)
		}
	}
	if hasAnyFullAccess {
		namespaces = nil
	}
	return clusterNames, namespaces, true
}

type proxyTarget struct {
	scope func(query string, clusterNames, namespaces []string) (string, error)
	base  string
	path  string
}

func (s *server) handleQuery(target proxyTarget, queryParam string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := auth.FromContext(r.Context())
		if !ok {
			httpx.Error(w, http.StatusUnauthorized, "no session")
			return
		}

		access, err := s.loadAccess(r.Context(), claims)
		if err != nil {
			log.Printf("loading access for user %s: %v", claims.UserID, err)
			httpx.Error(w, http.StatusInternalServerError, "could not resolve access")
			return
		}

		// Optional global cluster-picker selection from the frontend -- when
		// present, narrows every query to exactly that cluster instead of the
		// union of everything the user can see. Rejected outright (not
		// silently ignored) if the user has no grant for it at all.
		selected := r.URL.Query().Get("cluster")
		clusterNames, namespaces, ok := access.scopeFor(selected)
		if !ok {
			httpx.Error(w, http.StatusForbidden, fmt.Sprintf("no access to cluster %q", selected))
			return
		}
		if len(clusterNames) == 0 {
			httpx.Error(w, http.StatusForbidden, "no clusters granted to this user")
			return
		}

		rawQuery := r.URL.Query().Get(queryParam)
		if rawQuery == "" {
			httpx.Error(w, http.StatusBadRequest, fmt.Sprintf("missing %q parameter", queryParam))
			return
		}

		scoped, err := target.scope(rawQuery, clusterNames, namespaces)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, fmt.Sprintf("could not scope query: %v", err))
			return
		}

		q := r.URL.Query()
		q.Set(queryParam, scoped)

		upstream := strings.TrimRight(target.base, "/") + target.path + "?" + q.Encode()
		req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, upstream, nil)
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "could not build upstream request")
			return
		}
		// The ONLY place this header is ever set -- always derived from the
		// caller's validated JWT, never from anything the client sent. This
		// is what makes cross-tenant reads structurally impossible rather
		// than a policy check that a bug elsewhere could skip.
		req.Header.Set(tenancy.OrgIDHeader, tenancy.OrgIDForTenant(claims.TenantID))

		s.proxy(w, req)
	}
}

func (s *server) proxy(w http.ResponseWriter, req *http.Request) {
	resp, err := s.httpClient.Do(req)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, fmt.Sprintf("upstream request failed: %v", err))
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

// handleClusters lists the clusters/namespaces the caller can actually see
// -- what the frontend's cluster picker renders from, so a user never even
// sees the *name* of a cluster they have no grant for.
func (s *server) handleClusters(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "no session")
		return
	}

	type clusterOut struct {
		ID         uuid.UUID `json:"id"`
		Name       string    `json:"name"`
		Env        string    `json:"env"`
		FullAccess bool      `json:"fullAccess"`
	}
	var out []clusterOut

	// Same admin-bypass as loadAccess: an admin sees every cluster in their
	// own tenant rather than only ones an access_grants row happens to
	// mention (see the comment there for why that row often doesn't exist).
	if claims.Role == "admin" {
		rows, err := s.pool.Query(r.Context(), `SELECT id, name, env FROM clusters WHERE tenant_id = $1 ORDER BY name`, claims.TenantID)
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "could not load clusters")
			return
		}
		defer rows.Close()
		for rows.Next() {
			var c clusterOut
			if err := rows.Scan(&c.ID, &c.Name, &c.Env); err != nil {
				httpx.Error(w, http.StatusInternalServerError, "could not read clusters")
				return
			}
			c.FullAccess = true
			out = append(out, c)
		}
		httpx.JSON(w, http.StatusOK, out)
		return
	}

	rows, err := s.pool.Query(r.Context(), `
		SELECT DISTINCT c.id, c.name, c.env,
			(g.namespace_id IS NULL) AS full_access
		FROM access_grants g
		JOIN clusters c ON c.id = g.cluster_id
		WHERE g.user_id = $1
		ORDER BY c.name
	`, claims.UserID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not load clusters")
		return
	}
	defer rows.Close()

	for rows.Next() {
		var c clusterOut
		if err := rows.Scan(&c.ID, &c.Name, &c.Env, &c.FullAccess); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "could not read clusters")
			return
		}
		out = append(out, c)
	}
	httpx.JSON(w, http.StatusOK, out)
}

func main() {
	ctx := context.Background()

	pool, err := db.Connect(ctx)
	if err != nil {
		log.Fatalf("connecting to database: %v", err)
	}
	defer pool.Close()

	s := &server{
		pool:       pool,
		httpClient: &http.Client{Timeout: 30 * time.Second},
		mimirURL:   requireEnv("MIMIR_URL"),
		lokiURL:    requireEnv("LOKI_URL"),
		tempoURL:   requireEnv("TEMPO_URL"),
	}

	r := chi.NewRouter()
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) { httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"}) })

	protected := r.With(auth.RequireAuth)
	protected.Get("/clusters", s.handleClusters)
	protected.Get("/metrics/query_range", s.handleQuery(proxyTarget{
		scope: tenancy.ScopePromQL, base: s.mimirURL, path: "/prometheus/api/v1/query_range",
	}, "query"))
	protected.Get("/metrics/query", s.handleQuery(proxyTarget{
		scope: tenancy.ScopePromQL, base: s.mimirURL, path: "/prometheus/api/v1/query",
	}, "query"))
	protected.Get("/metrics/label_values", s.handleLabelValues)
	protected.Get("/logs/query_range", s.handleQuery(proxyTarget{
		scope: tenancy.ScopeLogQL, base: s.lokiURL, path: "/loki/api/v1/query_range",
	}, "query"))
	protected.Get("/logs/label_values", s.handleLogLabelValues)
	protected.Get("/traces/search", s.handleQuery(proxyTarget{
		scope: tenancy.ScopeTraceQL, base: s.tempoURL, path: "/api/search",
	}, "q"))
	protected.Get("/traces/{traceID}", s.handleTraceByID)
	protected.Get("/alerts", s.handleAlerts)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8085"
	}
	log.Printf("query-gateway listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}

// handleLabelValues proxies Mimir's label-values lookup (for populating the
// Metrics Explorer's dropdowns), scoped the same way a real query would be:
// restricted to the caller's clusters via a `match[]` selector rather than a
// raw label_values call, so a viewer can't enumerate label values that only
// exist on data they can't otherwise see.
func (s *server) handleLabelValues(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "no session")
		return
	}
	label := r.URL.Query().Get("label")
	if label == "" {
		httpx.Error(w, http.StatusBadRequest, "missing \"label\" parameter")
		return
	}

	access, err := s.loadAccess(r.Context(), claims)
	if err != nil {
		httpx.Error(w, http.StatusForbidden, "no clusters granted to this user")
		return
	}
	clusterNames, namespaces, ok := access.scopeFor(r.URL.Query().Get("cluster"))
	if !ok || len(clusterNames) == 0 {
		httpx.Error(w, http.StatusForbidden, "no clusters granted to this user")
		return
	}

	match := r.URL.Query().Get("metric")
	if match == "" {
		match = "{__name__=~\".+\"}"
	}
	scopedMatch, err := tenancy.ScopePromQL(match, clusterNames, namespaces)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, fmt.Sprintf("could not scope selector: %v", err))
		return
	}

	q := url.Values{}
	q.Set("match[]", scopedMatch)
	upstream := strings.TrimRight(s.mimirURL, "/") + "/prometheus/api/v1/label/" + url.PathEscape(label) + "/values?" + q.Encode()
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, upstream, nil)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not build upstream request")
		return
	}
	req.Header.Set(tenancy.OrgIDHeader, tenancy.OrgIDForTenant(claims.TenantID))
	s.proxy(w, req)
}

// handleLogLabelValues proxies Loki's label-values lookup, scoped the same
// way handleLabelValues scopes Mimir's. This exists separately from
// deriveLabelsFromInstance's client-side parsing (frontend) because deriving
// "all namespaces" from only the most recently fetched log lines would
// under-report real namespaces that simply haven't logged anything chatty
// enough to make the last N lines (a quiet workload like nginx can get
// crowded out by noisy system pods). Loki's label-values endpoint itself
// still defaults to a short implicit lookback (its own query_range default,
// not "all of retention") when start/end are omitted -- explicitly passing
// a wide start here is what actually makes this "the complete set", not
// just a time window short enough to hit the exact same crowding-out
// problem one level up.
func (s *server) handleLogLabelValues(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "no session")
		return
	}
	label := r.URL.Query().Get("label")
	if label == "" {
		httpx.Error(w, http.StatusBadRequest, "missing \"label\" parameter")
		return
	}

	access, err := s.loadAccess(r.Context(), claims)
	if err != nil {
		httpx.Error(w, http.StatusForbidden, "no clusters granted to this user")
		return
	}
	clusterNames, namespaces, ok := access.scopeFor(r.URL.Query().Get("cluster"))
	if !ok || len(clusterNames) == 0 {
		httpx.Error(w, http.StatusForbidden, "no clusters granted to this user")
		return
	}

	scopedQuery, err := tenancy.ScopeLogQL("{}", clusterNames, namespaces)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, fmt.Sprintf("could not scope query: %v", err))
		return
	}

	q := url.Values{}
	q.Set("query", scopedQuery)
	// 30 days, not Loki's own short default -- this dropdown should reflect
	// every namespace that has ever reported anything recently relevant,
	// not just the last few hours.
	q.Set("start", strconv.FormatInt(time.Now().Add(-30*24*time.Hour).UnixNano(), 10))
	q.Set("end", strconv.FormatInt(time.Now().UnixNano(), 10))
	upstream := strings.TrimRight(s.lokiURL, "/") + "/loki/api/v1/label/" + url.PathEscape(label) + "/values?" + q.Encode()
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, upstream, nil)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not build upstream request")
		return
	}
	req.Header.Set(tenancy.OrgIDHeader, tenancy.OrgIDForTenant(claims.TenantID))
	s.proxy(w, req)
}

// handleAlerts proxies Mimir's built-in multi-tenant Alertmanager (same
// X-Scope-OrgID isolation as everything else Mimir does) -- no separate
// Alertmanager deployment needed. Alertmanager's v2 API takes repeated
// `filter` matcher params, which is how the cluster/namespace restriction
// is applied here instead of the AST-rewrite ScopePromQL uses (Alertmanager
// has no query language to rewrite, just alert label matchers).
func (s *server) handleAlerts(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "no session")
		return
	}

	access, err := s.loadAccess(r.Context(), claims)
	if err != nil {
		log.Printf("loading access for user %s: %v", claims.UserID, err)
		httpx.Error(w, http.StatusInternalServerError, "could not resolve access")
		return
	}
	clusterNames, namespaces, ok := access.scopeFor(r.URL.Query().Get("cluster"))
	if !ok || len(clusterNames) == 0 {
		httpx.Error(w, http.StatusForbidden, "no clusters granted to this user")
		return
	}

	q := url.Values{}
	q.Add("filter", fmt.Sprintf(`cluster=~"%s"`, tenancy.RegexAlternation(clusterNames)))
	if len(namespaces) > 0 {
		q.Add("filter", fmt.Sprintf(`namespace=~"%s"`, tenancy.RegexAlternation(namespaces)))
	}

	upstream := strings.TrimRight(s.mimirURL, "/") + "/alertmanager/api/v2/alerts?" + q.Encode()
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, upstream, nil)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not build upstream request")
		return
	}
	req.Header.Set(tenancy.OrgIDHeader, tenancy.OrgIDForTenant(claims.TenantID))
	s.proxy(w, req)
}

func (s *server) handleTraceByID(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "no session")
		return
	}
	traceID := chi.URLParam(r, "traceID")

	upstream := strings.TrimRight(s.tempoURL, "/") + "/api/traces/" + url.PathEscape(traceID)
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, upstream, nil)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not build upstream request")
		return
	}
	req.Header.Set(tenancy.OrgIDHeader, tenancy.OrgIDForTenant(claims.TenantID))
	// Trace-by-ID has no query to scope by cluster/namespace -- Tempo's
	// OrgID isolation alone is what prevents cross-tenant lookups here.
	// Cross-cluster-within-tenant filtering for a single trace ID isn't
	// meaningful the same way a search query's filtering is.
	s.proxy(w, req)
}

func requireEnv(name string) string {
	v := os.Getenv(name)
	if v == "" {
		log.Fatalf("%s is not set", name)
	}
	return v
}
