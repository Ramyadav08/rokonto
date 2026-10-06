// ingest-gateway is the only endpoint Kubernetes clusters' monitoring agents
// (Grafana Alloy for metrics/logs, an OTel Collector for traces) ever talk
// to. It validates the cluster's bearer token, resolves the tenant it
// belongs to, and forwards the write payload upstream to Mimir/Loki/Tempo
// with X-Scope-OrgID set to that tenant -- never anything the client sends
// directly, so a compromised cluster token only ever exposes that one
// cluster's write path, never another tenant's.
package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
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

type resolvedCluster struct {
	clusterID uuid.UUID
	tenantID  uuid.UUID
}

// authenticate resolves the Authorization bearer token to a cluster.
// agent_token_hash is bcrypt (non-deterministic, so it can't be looked up by
// equality) -- agent_token_lookup narrows to the single candidate row by its
// plaintext prefix first, so this stays an O(1) indexed lookup plus one
// bcrypt comparison instead of scanning every cluster row on every write.
func (s *server) authenticate(r *http.Request) (resolvedCluster, bool) {
	const prefix = "Bearer "
	header := r.Header.Get("Authorization")
	log.Printf("DEBUG authenticate: header=%q len=%d", header, len(header))
	if !strings.HasPrefix(header, prefix) {
		return resolvedCluster{}, false
	}
	token := strings.TrimPrefix(header, prefix)
	if len(token) < 12 {
		return resolvedCluster{}, false
	}

	var rc resolvedCluster
	var hash string
	err := s.pool.QueryRow(r.Context(),
		`SELECT id, tenant_id, agent_token_hash FROM clusters WHERE agent_token_lookup = $1`,
		token[:12],
	).Scan(&rc.clusterID, &rc.tenantID, &hash)
	if err != nil {
		return resolvedCluster{}, false
	}
	if !auth.CheckAgentToken(hash, token) {
		return resolvedCluster{}, false
	}
	return rc, true
}

// touchLastSeen updates last_seen_at without holding up the response --
// worth logging on failure, never worth failing the write over.
func (s *server) touchLastSeen(clusterID uuid.UUID) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if _, err := s.pool.Exec(ctx, `UPDATE clusters SET last_seen_at = now() WHERE id = $1`, clusterID); err != nil {
			log.Printf("updating last_seen_at for cluster %s: %v", clusterID, err)
		}
	}()
}

// handleIngest builds a handler that authenticates the cluster token, then
// streams the request body through byte-for-byte to base+path. These are
// binary/protobuf payloads (Prometheus remote_write, OTLP) -- never parsed
// or modified, just forwarded with the tenant's OrgID attached.
func (s *server) handleIngest(base, path string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rc, ok := s.authenticate(r)
		if !ok {
			httpx.Error(w, http.StatusUnauthorized, "invalid or missing agent token")
			return
		}
		s.touchLastSeen(rc.clusterID)

		upstream := strings.TrimRight(base, "/") + path
		req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, upstream, r.Body)
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "could not build upstream request")
			return
		}
		req.Header = r.Header.Clone()
		req.Header.Del("Authorization")
		req.ContentLength = r.ContentLength

		// The ONLY place this header is set -- derived from the token lookup
		// above, never from anything the client sends. This is what keeps a
		// leaked cluster token scoped to its own tenant's storage.
		req.Header.Set(tenancy.OrgIDHeader, tenancy.OrgIDForTenant(rc.tenantID))

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

type namespaceReportRequest struct {
	Namespaces []string `json:"namespaces"`
}

// handleNamespaceReport keeps the namespaces table current from what each
// cluster's agent actually discovers via the k8s API -- what rbac-service's
// checkbox UI renders from. Handled directly here against the shared pool
// rather than routed through tenant-service, since the cluster's identity is
// already resolved from the token by this point.
func (s *server) handleNamespaceReport(w http.ResponseWriter, r *http.Request) {
	rc, ok := s.authenticate(r)
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "invalid or missing agent token")
		return
	}

	var req namespaceReportRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	for _, name := range req.Namespaces {
		if _, err := s.pool.Exec(r.Context(),
			`INSERT INTO namespaces (cluster_id, name) VALUES ($1, $2)
			 ON CONFLICT (cluster_id, name) DO UPDATE SET last_seen_at = now()`,
			rc.clusterID, name,
		); err != nil {
			log.Printf("upserting namespace %q for cluster %s: %v", name, rc.clusterID, err)
			httpx.Error(w, http.StatusInternalServerError, "could not record namespaces")
			return
		}
	}

	s.touchLastSeen(rc.clusterID)
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
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
	r.Post("/metrics/write", s.handleIngest(s.mimirURL, "/api/v1/push"))
	r.Post("/logs/push", s.handleIngest(s.lokiURL, "/loki/api/v1/push"))
	r.Post("/traces/v1/traces", s.handleIngest(s.tempoURL, "/v1/traces"))
	r.Post("/namespaces/report", s.handleNamespaceReport)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8084"
	}
	log.Printf("ingest-gateway listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}

func requireEnv(name string) string {
	v := os.Getenv(name)
	if v == "" {
		log.Fatalf("%s is not set", name)
	}
	return v
}
