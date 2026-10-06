// blackbox-service owns tenants' synthetic/blackbox URL checks: the CRUD
// registry of what to probe (synthetic_checks), plus a background goroutine
// in this same process that actually probes each due URL on a fixed
// scheduler tick and pushes the result to Mimir as real probe_success /
// probe_duration_seconds metrics over the standard Prometheus remote_write
// protocol -- scoped by X-Scope-OrgID exactly like every other write path in
// this system, so synthetic uptime data flows through the same
// query-gateway/RBAC path as everything else with zero special-casing.
package main

import (
	"context"
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
)

const (
	defaultIntervalSeconds = 60
	minIntervalSeconds     = 10
)

type server struct {
	pool *pgxpool.Pool
}

type checkResponse struct {
	ID              uuid.UUID `json:"id"`
	Name            string    `json:"name"`
	URL             string    `json:"url"`
	IntervalSeconds int       `json:"intervalSeconds"`
	CreatedAt       string    `json:"createdAt"`
}

type createCheckRequest struct {
	Name            string `json:"name"`
	URL             string `json:"url"`
	IntervalSeconds int    `json:"intervalSeconds"`
}

func validCheckURL(url string) bool {
	return strings.HasPrefix(url, "http://") || strings.HasPrefix(url, "https://")
}

func (s *server) handleCreateCheck(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "no session")
		return
	}

	var req createCheckRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		httpx.Error(w, http.StatusBadRequest, "name is required")
		return
	}
	if !validCheckURL(req.URL) {
		httpx.Error(w, http.StatusBadRequest, "url must start with http:// or https://")
		return
	}
	if req.IntervalSeconds == 0 {
		req.IntervalSeconds = defaultIntervalSeconds
	}
	if req.IntervalSeconds < minIntervalSeconds {
		httpx.Error(w, http.StatusBadRequest, "intervalSeconds must be at least 10")
		return
	}

	var (
		id        uuid.UUID
		createdAt time.Time
	)
	err := s.pool.QueryRow(r.Context(),
		`INSERT INTO synthetic_checks (tenant_id, name, url, interval_seconds) VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
		claims.TenantID, req.Name, req.URL, req.IntervalSeconds,
	).Scan(&id, &createdAt)
	if err != nil {
		log.Printf("creating synthetic check: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not create check")
		return
	}

	httpx.JSON(w, http.StatusCreated, checkResponse{
		ID:              id,
		Name:            req.Name,
		URL:             req.URL,
		IntervalSeconds: req.IntervalSeconds,
		CreatedAt:       createdAt.Format(time.RFC3339),
	})
}

func (s *server) handleListChecks(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "no session")
		return
	}

	rows, err := s.pool.Query(r.Context(),
		`SELECT id, name, url, interval_seconds, created_at FROM synthetic_checks WHERE tenant_id = $1 ORDER BY created_at`,
		claims.TenantID,
	)
	if err != nil {
		log.Printf("listing synthetic checks: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not list checks")
		return
	}
	defer rows.Close()

	checks := []checkResponse{}
	for rows.Next() {
		var (
			c         checkResponse
			createdAt time.Time
		)
		if err := rows.Scan(&c.ID, &c.Name, &c.URL, &c.IntervalSeconds, &createdAt); err != nil {
			log.Printf("scanning synthetic check: %v", err)
			httpx.Error(w, http.StatusInternalServerError, "could not list checks")
			return
		}
		c.CreatedAt = createdAt.Format(time.RFC3339)
		checks = append(checks, c)
	}
	if err := rows.Err(); err != nil {
		log.Printf("iterating synthetic checks: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not list checks")
		return
	}

	httpx.JSON(w, http.StatusOK, checks)
}

func (s *server) handleDeleteCheck(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "no session")
		return
	}

	checkID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid check id")
		return
	}

	// Scoping the WHERE by tenant_id, not just id, is the actual isolation
	// check -- a cross-tenant delete becomes a no-op rather than relying on a
	// separate lookup-then-delete.
	tag, err := s.pool.Exec(r.Context(),
		`DELETE FROM synthetic_checks WHERE id = $1 AND tenant_id = $2`,
		checkID, claims.TenantID,
	)
	if err != nil {
		log.Printf("deleting synthetic check: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not delete check")
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.Error(w, http.StatusNotFound, "check not found")
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func main() {
	ctx := context.Background()

	mimirURL := requireEnv("MIMIR_URL")

	pool, err := db.Connect(ctx)
	if err != nil {
		log.Fatalf("connecting to database: %v", err)
	}
	defer pool.Close()

	s := &server{pool: pool}

	p := newProber(pool, mimirURL)
	go p.run(ctx)

	r := chi.NewRouter()
	r.With(auth.RequireAuth).Post("/checks", s.handleCreateCheck)
	r.With(auth.RequireAuth).Get("/checks", s.handleListChecks)
	r.With(auth.RequireAuth).Delete("/checks/{id}", s.handleDeleteCheck)
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8088"
	}
	log.Printf("blackbox-service listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}

func requireEnv(name string) string {
	v := os.Getenv(name)
	if v == "" {
		log.Fatalf("%s is not set", name)
	}
	return v
}
