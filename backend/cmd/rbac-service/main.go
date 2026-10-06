// rbac-service manages a tenant's users and their per-cluster/namespace
// access grants.
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
	pool *pgxpool.Pool
}

type userResponse struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	CreatedAt string    `json:"createdAt"`
}

func validRole(role string) bool {
	switch role {
	case "admin", "editor", "viewer":
		return true
	}
	return false
}

func (s *server) handleListUsers(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "no session")
		return
	}

	rows, err := s.pool.Query(r.Context(),
		`SELECT id, email, role, created_at FROM users WHERE tenant_id = $1 ORDER BY created_at`,
		claims.TenantID,
	)
	if err != nil {
		log.Printf("listing users: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not list users")
		return
	}
	defer rows.Close()

	users := []userResponse{}
	for rows.Next() {
		var (
			u         userResponse
			createdAt time.Time
		)
		if err := rows.Scan(&u.ID, &u.Email, &u.Role, &createdAt); err != nil {
			log.Printf("scanning user: %v", err)
			httpx.Error(w, http.StatusInternalServerError, "could not list users")
			return
		}
		u.CreatedAt = createdAt.Format(time.RFC3339)
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		log.Printf("iterating users: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not list users")
		return
	}

	httpx.JSON(w, http.StatusOK, users)
}

type createUserRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

func (s *server) handleCreateUser(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "no session")
		return
	}
	if claims.Role != "admin" {
		httpx.Error(w, http.StatusForbidden, "admin role required")
		return
	}

	var req createUserRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Email == "" || req.Password == "" || !validRole(req.Role) {
		httpx.Error(w, http.StatusBadRequest, "email, password are required and role must be one of admin, editor, viewer")
		return
	}

	passwordHash, err := auth.HashPassword(req.Password)
	if err != nil {
		log.Printf("hashing password: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not create user")
		return
	}

	var (
		u         userResponse
		createdAt time.Time
	)
	u.Email = req.Email
	u.Role = req.Role
	err = s.pool.QueryRow(r.Context(),
		`INSERT INTO users (tenant_id, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
		claims.TenantID, req.Email, passwordHash, req.Role,
	).Scan(&u.ID, &createdAt)
	if err != nil {
		log.Printf("creating user: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not create user")
		return
	}
	u.CreatedAt = createdAt.Format(time.RFC3339)

	httpx.JSON(w, http.StatusCreated, u)
}

func (s *server) handleDeleteUser(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "no session")
		return
	}
	if claims.Role != "admin" {
		httpx.Error(w, http.StatusForbidden, "admin role required")
		return
	}

	userID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid user id")
		return
	}

	tag, err := s.pool.Exec(r.Context(),
		`DELETE FROM users WHERE id = $1 AND tenant_id = $2`,
		userID, claims.TenantID,
	)
	if err != nil {
		log.Printf("deleting user: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not delete user")
		return
	}
	if tag.RowsAffected() == 0 {
		httpx.Error(w, http.StatusNotFound, "user not found")
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

type accessGrantResponse struct {
	ClusterID     uuid.UUID  `json:"clusterId"`
	ClusterName   string     `json:"clusterName"`
	ClusterEnv    string     `json:"clusterEnv"`
	NamespaceID   *uuid.UUID `json:"namespaceId"`
	NamespaceName *string    `json:"namespaceName"`
}

// userBelongsToTenant is used everywhere a {id} path param names a user --
// without it a caller could pass another tenant's user id and act on it.
func (s *server) userBelongsToTenant(ctx context.Context, userID, tenantID uuid.UUID) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2)`,
		userID, tenantID,
	).Scan(&exists)
	return exists, err
}

func (s *server) handleGetUserAccess(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "no session")
		return
	}

	userID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid user id")
		return
	}

	owns, err := s.userBelongsToTenant(r.Context(), userID, claims.TenantID)
	if err != nil {
		log.Printf("checking user ownership: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not fetch access")
		return
	}
	if !owns {
		httpx.Error(w, http.StatusNotFound, "user not found")
		return
	}

	rows, err := s.pool.Query(r.Context(),
		`SELECT c.id, c.name, c.env, n.id, n.name
		 FROM access_grants g
		 JOIN clusters c ON c.id = g.cluster_id
		 LEFT JOIN namespaces n ON n.id = g.namespace_id
		 WHERE g.user_id = $1
		 ORDER BY c.name, n.name`,
		userID,
	)
	if err != nil {
		log.Printf("listing access grants: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not fetch access")
		return
	}
	defer rows.Close()

	grants := []accessGrantResponse{}
	for rows.Next() {
		var g accessGrantResponse
		if err := rows.Scan(&g.ClusterID, &g.ClusterName, &g.ClusterEnv, &g.NamespaceID, &g.NamespaceName); err != nil {
			log.Printf("scanning access grant: %v", err)
			httpx.Error(w, http.StatusInternalServerError, "could not fetch access")
			return
		}
		grants = append(grants, g)
	}
	if err := rows.Err(); err != nil {
		log.Printf("iterating access grants: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not fetch access")
		return
	}

	httpx.JSON(w, http.StatusOK, grants)
}

type putAccessRequest struct {
	Grants []struct {
		ClusterID   uuid.UUID  `json:"clusterId"`
		NamespaceID *uuid.UUID `json:"namespaceId"`
	} `json:"grants"`
}

func (s *server) handlePutUserAccess(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "no session")
		return
	}
	if claims.Role != "admin" {
		httpx.Error(w, http.StatusForbidden, "admin role required")
		return
	}

	userID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid user id")
		return
	}

	owns, err := s.userBelongsToTenant(r.Context(), userID, claims.TenantID)
	if err != nil {
		log.Printf("checking user ownership: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not save access")
		return
	}
	if !owns {
		httpx.Error(w, http.StatusNotFound, "user not found")
		return
	}

	var req putAccessRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Every clusterId/namespaceId must be verified against the caller's
	// tenant before anything is inserted -- accepting an unverified id from
	// another tenant here would be a cross-tenant privilege escalation.
	for _, g := range req.Grants {
		var clusterOK bool
		if err := s.pool.QueryRow(r.Context(),
			`SELECT EXISTS(SELECT 1 FROM clusters WHERE id = $1 AND tenant_id = $2)`,
			g.ClusterID, claims.TenantID,
		).Scan(&clusterOK); err != nil {
			log.Printf("checking cluster ownership: %v", err)
			httpx.Error(w, http.StatusInternalServerError, "could not save access")
			return
		}
		if !clusterOK {
			httpx.Error(w, http.StatusBadRequest, "clusterId does not belong to your tenant")
			return
		}

		if g.NamespaceID != nil {
			var namespaceOK bool
			if err := s.pool.QueryRow(r.Context(),
				`SELECT EXISTS(SELECT 1 FROM namespaces n JOIN clusters c ON c.id = n.cluster_id
				 WHERE n.id = $1 AND n.cluster_id = $2 AND c.tenant_id = $3)`,
				*g.NamespaceID, g.ClusterID, claims.TenantID,
			).Scan(&namespaceOK); err != nil {
				log.Printf("checking namespace ownership: %v", err)
				httpx.Error(w, http.StatusInternalServerError, "could not save access")
				return
			}
			if !namespaceOK {
				httpx.Error(w, http.StatusBadRequest, "namespaceId does not belong to the given cluster")
				return
			}
		}
	}

	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		log.Printf("beginning tx: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not save access")
		return
	}
	defer tx.Rollback(r.Context())

	if _, err := tx.Exec(r.Context(), `DELETE FROM access_grants WHERE user_id = $1`, userID); err != nil {
		log.Printf("clearing access grants: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not save access")
		return
	}

	for _, g := range req.Grants {
		if _, err := tx.Exec(r.Context(),
			`INSERT INTO access_grants (user_id, cluster_id, namespace_id) VALUES ($1, $2, $3)`,
			userID, g.ClusterID, g.NamespaceID,
		); err != nil {
			log.Printf("inserting access grant: %v", err)
			httpx.Error(w, http.StatusInternalServerError, "could not save access")
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		log.Printf("committing tx: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not save access")
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func main() {
	ctx := context.Background()

	pool, err := db.Connect(ctx)
	if err != nil {
		log.Fatalf("connecting to database: %v", err)
	}
	defer pool.Close()

	s := &server{pool: pool}

	r := chi.NewRouter()
	r.With(auth.RequireAuth).Get("/users", s.handleListUsers)
	r.With(auth.RequireAuth).Post("/users", s.handleCreateUser)
	r.With(auth.RequireAuth).Delete("/users/{id}", s.handleDeleteUser)
	r.With(auth.RequireAuth).Get("/users/{id}/access", s.handleGetUserAccess)
	r.With(auth.RequireAuth).Put("/users/{id}/access", s.handlePutUserAccess)
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8083"
	}
	log.Printf("rbac-service listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}
