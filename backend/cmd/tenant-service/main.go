// tenant-service owns tenants' clusters and namespaces: creating/deleting
// clusters, issuing agent tokens, and recording what namespaces each
// cluster's agent reports seeing.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"observex/backend/internal/auth"
	"observex/backend/internal/db"
	"observex/backend/internal/httpx"
)

type server struct {
	pool        *pgxpool.Pool
	internalKey string
}

type clusterResponse struct {
	ID         uuid.UUID `json:"id"`
	Name       string    `json:"name"`
	Env        string    `json:"env"`
	LastSeenAt *string   `json:"lastSeenAt"`
	CreatedAt  string    `json:"createdAt"`
}

func validEnv(env string) bool {
	switch env {
	case "dev", "stg", "prod":
		return true
	}
	return false
}

func (s *server) handleListClusters(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "no session")
		return
	}

	rows, err := s.pool.Query(r.Context(),
		`SELECT id, name, env, last_seen_at, created_at FROM clusters WHERE tenant_id = $1 ORDER BY created_at`,
		claims.TenantID,
	)
	if err != nil {
		log.Printf("listing clusters: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not list clusters")
		return
	}
	defer rows.Close()

	clusters := []clusterResponse{}
	for rows.Next() {
		var (
			c          clusterResponse
			lastSeenAt *time.Time
			createdAt  time.Time
		)
		if err := rows.Scan(&c.ID, &c.Name, &c.Env, &lastSeenAt, &createdAt); err != nil {
			log.Printf("scanning cluster: %v", err)
			httpx.Error(w, http.StatusInternalServerError, "could not list clusters")
			return
		}
		if lastSeenAt != nil {
			formatted := lastSeenAt.Format(time.RFC3339)
			c.LastSeenAt = &formatted
		}
		c.CreatedAt = createdAt.Format(time.RFC3339)
		clusters = append(clusters, c)
	}
	if err := rows.Err(); err != nil {
		log.Printf("iterating clusters: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not list clusters")
		return
	}

	httpx.JSON(w, http.StatusOK, clusters)
}

type createClusterRequest struct {
	Name string `json:"name"`
	Env  string `json:"env"`
}

type createClusterResponse struct {
	ID         uuid.UUID `json:"id"`
	Name       string    `json:"name"`
	Env        string    `json:"env"`
	CreatedAt  string    `json:"createdAt"`
	AgentToken string    `json:"agentToken"`
	Note       string    `json:"note"`
}

func (s *server) handleCreateCluster(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "no session")
		return
	}
	if claims.Role != "admin" {
		httpx.Error(w, http.StatusForbidden, "admin role required")
		return
	}

	var req createClusterRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" || !validEnv(req.Env) {
		httpx.Error(w, http.StatusBadRequest, "name is required and env must be one of dev, stg, prod")
		return
	}

	plainToken, tokenHash, err := auth.GenerateAgentToken()
	if err != nil {
		log.Printf("generating agent token: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not create cluster")
		return
	}

	var (
		id        uuid.UUID
		createdAt time.Time
	)
	// agent_token_lookup (first 12 chars of the plaintext token, stored
	// unhashed) is what ingest-gateway indexes on to find the candidate
	// cluster row in O(1) before the real bcrypt check -- bcrypt hashes
	// can't be looked up by equality since they're salted/non-deterministic.
	// Omitting this (as this handler originally did) means the token it
	// just generated can never actually authenticate anything.
	err = s.pool.QueryRow(r.Context(),
		`INSERT INTO clusters (tenant_id, name, env, agent_token_hash, agent_token_lookup) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
		claims.TenantID, req.Name, req.Env, tokenHash, plainToken[:12],
	).Scan(&id, &createdAt)
	if err != nil {
		log.Printf("creating cluster: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not create cluster")
		return
	}

	httpx.JSON(w, http.StatusCreated, createClusterResponse{
		ID:         id,
		Name:       req.Name,
		Env:        req.Env,
		CreatedAt:  createdAt.Format(time.RFC3339),
		AgentToken: plainToken,
		Note:       "this token is shown once and cannot be retrieved again",
	})
}

func (s *server) handleDeleteCluster(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "no session")
		return
	}
	if claims.Role != "admin" {
		httpx.Error(w, http.StatusForbidden, "admin role required")
		return
	}

	clusterID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid cluster id")
		return
	}

	// Scoping the WHERE by tenant_id, not just id, is the actual isolation
	// check -- it makes a cross-tenant delete a no-op instead of relying on
	// a lookup-then-delete that could be skipped or reordered elsewhere.
	tag, err := s.pool.Exec(r.Context(),
		`DELETE FROM clusters WHERE id = $1 AND tenant_id = $2`,
		clusterID, claims.TenantID,
	)
	if err != nil {
		log.Printf("deleting cluster: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not delete cluster")
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.Error(w, http.StatusNotFound, "cluster not found")
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

type namespaceResponse struct {
	ID         uuid.UUID `json:"id"`
	Name       string    `json:"name"`
	LastSeenAt string    `json:"lastSeenAt"`
}

func (s *server) handleListNamespaces(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "no session")
		return
	}

	clusterID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid cluster id")
		return
	}

	var owns bool
	if err := s.pool.QueryRow(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM clusters WHERE id = $1 AND tenant_id = $2)`,
		clusterID, claims.TenantID,
	).Scan(&owns); err != nil {
		log.Printf("checking cluster ownership: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not list namespaces")
		return
	}
	if !owns {
		httpx.Error(w, http.StatusNotFound, "cluster not found")
		return
	}

	rows, err := s.pool.Query(r.Context(),
		`SELECT id, name, last_seen_at FROM namespaces WHERE cluster_id = $1 ORDER BY name`,
		clusterID,
	)
	if err != nil {
		log.Printf("listing namespaces: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not list namespaces")
		return
	}
	defer rows.Close()

	namespaces := []namespaceResponse{}
	for rows.Next() {
		var (
			n          namespaceResponse
			lastSeenAt time.Time
		)
		if err := rows.Scan(&n.ID, &n.Name, &lastSeenAt); err != nil {
			log.Printf("scanning namespace: %v", err)
			httpx.Error(w, http.StatusInternalServerError, "could not list namespaces")
			return
		}
		n.LastSeenAt = lastSeenAt.Format(time.RFC3339)
		namespaces = append(namespaces, n)
	}
	if err := rows.Err(); err != nil {
		log.Printf("iterating namespaces: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not list namespaces")
		return
	}

	httpx.JSON(w, http.StatusOK, namespaces)
}

type reportNamespacesRequest struct {
	Namespaces []string `json:"namespaces"`
}

// handleReportNamespaces has no JWT auth -- it's called by ingest-gateway on
// behalf of a cluster-agent, which authenticates with its own agent token,
// not a user session. The shared internal key keeps this off the public
// internet as an open endpoint.
func (s *server) handleReportNamespaces(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("X-Internal-Key") != s.internalKey {
		httpx.Error(w, http.StatusUnauthorized, "invalid internal key")
		return
	}

	clusterID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid cluster id")
		return
	}

	var req reportNamespacesRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		log.Printf("beginning tx: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not report namespaces")
		return
	}
	defer tx.Rollback(r.Context())

	tag, err := tx.Exec(r.Context(),
		`UPDATE clusters SET last_seen_at = now() WHERE id = $1`,
		clusterID,
	)
	if err != nil {
		log.Printf("updating cluster last_seen_at: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not report namespaces")
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.Error(w, http.StatusNotFound, "cluster not found")
		return
	}

	for _, name := range req.Namespaces {
		if _, err := tx.Exec(r.Context(),
			`INSERT INTO namespaces (cluster_id, name) VALUES ($1, $2)
			 ON CONFLICT (cluster_id, name) DO UPDATE SET last_seen_at = now()`,
			clusterID, name,
		); err != nil {
			log.Printf("upserting namespace: %v", err)
			httpx.Error(w, http.StatusInternalServerError, "could not report namespaces")
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		log.Printf("committing tx: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not report namespaces")
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func main() {
	ctx := context.Background()

	internalKey := os.Getenv("INTERNAL_API_KEY")
	if internalKey == "" {
		log.Fatal("INTERNAL_API_KEY is not set")
	}

	pool, err := db.Connect(ctx)
	if err != nil {
		log.Fatalf("connecting to database: %v", err)
	}
	defer pool.Close()

	s := &server{pool: pool, internalKey: internalKey}

	r := chi.NewRouter()
	r.With(auth.RequireAuth).Get("/clusters", s.handleListClusters)
	r.With(auth.RequireAuth).Post("/clusters", s.handleCreateCluster)
	r.With(auth.RequireAuth).Delete("/clusters/{id}", s.handleDeleteCluster)
	r.With(auth.RequireAuth).Get("/clusters/{id}/namespaces", s.handleListNamespaces)
	r.Post("/clusters/{id}/namespaces/report", s.handleReportNamespaces)
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8082"
	}
	log.Printf("tenant-service listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}
