// platform-admin-service is the backend for Observex's internal
// platform-admin panel -- the "our own ops/support team" side, not any
// tenant's own staff. It authenticates platform staff via auth.PlatformClaims
// (a completely separate identity/token space from tenant-user sessions) and
// gives them an unscoped, cross-tenant view of every client. There is no
// signup here: platform admin accounts are provisioned via this binary's own
// --seed-admin-email/--seed-admin-password flags, never self-service.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"observex/backend/internal/auth"
	"observex/backend/internal/db"
	"observex/backend/internal/httpx"
)

type server struct {
	pool *pgxpool.Pool
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type adminResponse struct {
	ID    uuid.UUID `json:"id"`
	Email string    `json:"email"`
}

type loginResponse struct {
	Token string        `json:"token"`
	Admin adminResponse `json:"admin"`
}

func (s *server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	var (
		id           uuid.UUID
		passwordHash string
	)
	err := s.pool.QueryRow(r.Context(),
		`SELECT id, password_hash FROM platform_admins WHERE email = $1`,
		req.Email,
	).Scan(&id, &passwordHash)
	if err != nil {
		// Same response whether the email doesn't exist or the password is
		// wrong -- distinguishing the two lets an attacker enumerate valid
		// platform-staff emails.
		httpx.Error(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	if !auth.CheckPassword(passwordHash, req.Password) {
		httpx.Error(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	token, err := auth.IssuePlatformToken(id, req.Email)
	if err != nil {
		log.Printf("issuing platform token: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not issue session")
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     auth.PlatformSessionCookie,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int((12 * time.Hour).Seconds()),
	})

	httpx.JSON(w, http.StatusOK, loginResponse{
		Token: token,
		Admin: adminResponse{ID: id, Email: req.Email},
	})
}

func (s *server) handleLogout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     auth.PlatformSessionCookie,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *server) handleMe(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.PlatformFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "no session")
		return
	}
	httpx.JSON(w, http.StatusOK, adminResponse{ID: claims.AdminID, Email: claims.Email})
}

// handleListAdmins gives any logged-in platform staff member the list of
// their peers, so the support-ticket UI can offer a real assignee dropdown
// instead of a free-text field with no way to know who else exists.
func (s *server) handleListAdmins(w http.ResponseWriter, r *http.Request) {
	rows, err := s.pool.Query(r.Context(), `SELECT id, email FROM platform_admins ORDER BY email`)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not load admins")
		return
	}
	defer rows.Close()

	out := []adminResponse{}
	for rows.Next() {
		var a adminResponse
		if err := rows.Scan(&a.ID, &a.Email); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "could not read admins")
			return
		}
		out = append(out, a)
	}
	httpx.JSON(w, http.StatusOK, out)
}

type tenantListItem struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	Slug         string    `json:"slug"`
	CreatedAt    string    `json:"createdAt"`
	ClusterCount int       `json:"clusterCount"`
	UserCount    int       `json:"userCount"`
}

// handleListTenants gives platform staff the cross-tenant view that is the
// whole point of this service -- no tenant_id scoping anywhere. Cluster and
// user counts come from per-tenant subqueries rather than a join, which
// would otherwise multiply rows (a tenant with 3 clusters and 5 users joined
// naively produces 15 rows) and need extra DISTINCT-counting to undo.
func (s *server) handleListTenants(w http.ResponseWriter, r *http.Request) {
	rows, err := s.pool.Query(r.Context(), `
		SELECT
			t.id,
			t.name,
			t.slug,
			t.created_at,
			(SELECT COUNT(*) FROM clusters c WHERE c.tenant_id = t.id) AS cluster_count,
			(SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) AS user_count
		FROM tenants t
		ORDER BY t.created_at DESC
	`)
	if err != nil {
		log.Printf("listing tenants: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not list tenants")
		return
	}
	defer rows.Close()

	tenants := []tenantListItem{}
	for rows.Next() {
		var (
			t         tenantListItem
			createdAt time.Time
		)
		if err := rows.Scan(&t.ID, &t.Name, &t.Slug, &createdAt, &t.ClusterCount, &t.UserCount); err != nil {
			log.Printf("scanning tenant: %v", err)
			httpx.Error(w, http.StatusInternalServerError, "could not list tenants")
			return
		}
		t.CreatedAt = createdAt.Format(time.RFC3339)
		tenants = append(tenants, t)
	}
	if err := rows.Err(); err != nil {
		log.Printf("iterating tenants: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not list tenants")
		return
	}

	httpx.JSON(w, http.StatusOK, tenants)
}

type tenantClusterItem struct {
	ID         uuid.UUID `json:"id"`
	Name       string    `json:"name"`
	Env        string    `json:"env"`
	LastSeenAt *string   `json:"lastSeenAt"`
	CreatedAt  string    `json:"createdAt"`
}

type tenantUserItem struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	CreatedAt string    `json:"createdAt"`
}

type tenantDetailResponse struct {
	ID        uuid.UUID           `json:"id"`
	Name      string              `json:"name"`
	Slug      string              `json:"slug"`
	CreatedAt string              `json:"createdAt"`
	Clusters  []tenantClusterItem `json:"clusters"`
	Users     []tenantUserItem    `json:"users"`
}

// handleGetTenant looks up a tenant by id with no tenant-scoping check --
// platform staff can see every client -- but still 404s on an invalid or
// nonexistent id rather than returning an empty-but-200 shell, so the
// frontend can tell "not found" apart from "found, nothing in it yet".
func (s *server) handleGetTenant(w http.ResponseWriter, r *http.Request) {
	tenantID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "tenant not found")
		return
	}

	var (
		resp      tenantDetailResponse
		createdAt time.Time
	)
	err = s.pool.QueryRow(r.Context(),
		`SELECT id, name, slug, created_at FROM tenants WHERE id = $1`,
		tenantID,
	).Scan(&resp.ID, &resp.Name, &resp.Slug, &createdAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			httpx.Error(w, http.StatusNotFound, "tenant not found")
			return
		}
		log.Printf("looking up tenant: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not load tenant")
		return
	}
	resp.CreatedAt = createdAt.Format(time.RFC3339)

	clusterRows, err := s.pool.Query(r.Context(),
		`SELECT id, name, env, last_seen_at, created_at FROM clusters WHERE tenant_id = $1 ORDER BY created_at`,
		tenantID,
	)
	if err != nil {
		log.Printf("listing tenant clusters: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not load tenant")
		return
	}
	resp.Clusters = []tenantClusterItem{}
	for clusterRows.Next() {
		var (
			c                tenantClusterItem
			lastSeenAt       *time.Time
			clusterCreatedAt time.Time
		)
		if err := clusterRows.Scan(&c.ID, &c.Name, &c.Env, &lastSeenAt, &clusterCreatedAt); err != nil {
			clusterRows.Close()
			log.Printf("scanning tenant cluster: %v", err)
			httpx.Error(w, http.StatusInternalServerError, "could not load tenant")
			return
		}
		if lastSeenAt != nil {
			formatted := lastSeenAt.Format(time.RFC3339)
			c.LastSeenAt = &formatted
		}
		c.CreatedAt = clusterCreatedAt.Format(time.RFC3339)
		resp.Clusters = append(resp.Clusters, c)
	}
	if err := clusterRows.Err(); err != nil {
		clusterRows.Close()
		log.Printf("iterating tenant clusters: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not load tenant")
		return
	}
	clusterRows.Close()

	userRows, err := s.pool.Query(r.Context(),
		`SELECT id, email, role, created_at FROM users WHERE tenant_id = $1 ORDER BY created_at`,
		tenantID,
	)
	if err != nil {
		log.Printf("listing tenant users: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not load tenant")
		return
	}
	resp.Users = []tenantUserItem{}
	for userRows.Next() {
		var (
			u             tenantUserItem
			userCreatedAt time.Time
		)
		if err := userRows.Scan(&u.ID, &u.Email, &u.Role, &userCreatedAt); err != nil {
			userRows.Close()
			log.Printf("scanning tenant user: %v", err)
			httpx.Error(w, http.StatusInternalServerError, "could not load tenant")
			return
		}
		u.CreatedAt = userCreatedAt.Format(time.RFC3339)
		resp.Users = append(resp.Users, u)
	}
	if err := userRows.Err(); err != nil {
		userRows.Close()
		log.Printf("iterating tenant users: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not load tenant")
		return
	}
	userRows.Close()

	httpx.JSON(w, http.StatusOK, resp)
}

// seedAdmin upserts a platform_admins row from CLI flags, mirroring the
// ON CONFLICT ... DO UPDATE pattern cmd/seed/main.go uses for the demo
// tenant admin user. Platform-admin provisioning lives here rather than in
// the shared seed CLI -- there's no self-service signup for platform staff,
// so this binary is the only place that ever needs to create one.
func seedAdmin(ctx context.Context, pool *pgxpool.Pool, email, password string) error {
	passwordHash, err := auth.HashPassword(password)
	if err != nil {
		return fmt.Errorf("hashing admin password: %w", err)
	}
	var id uuid.UUID
	err = pool.QueryRow(ctx,
		`INSERT INTO platform_admins (email, password_hash) VALUES ($1, $2)
		 ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
		 RETURNING id`,
		email, passwordHash,
	).Scan(&id)
	if err != nil {
		return fmt.Errorf("upserting platform admin: %w", err)
	}
	fmt.Printf("platform admin ready: %s (%s)\n", email, id)
	return nil
}

func main() {
	seedAdminEmail := flag.String("seed-admin-email", "", "if set (with --seed-admin-password), upsert a platform admin with this email and exit instead of starting the server")
	seedAdminPassword := flag.String("seed-admin-password", "", "password for the admin provisioned via --seed-admin-email")
	flag.Parse()

	ctx := context.Background()

	pool, err := db.Connect(ctx)
	if err != nil {
		log.Fatalf("connecting to database: %v", err)
	}
	defer pool.Close()

	if *seedAdminEmail != "" {
		if *seedAdminPassword == "" {
			log.Fatal("--seed-admin-password is required when --seed-admin-email is set")
		}
		if err := seedAdmin(ctx, pool, *seedAdminEmail, *seedAdminPassword); err != nil {
			log.Fatal(err)
		}
		return
	}

	s := &server{pool: pool}

	r := chi.NewRouter()
	r.Post("/login", s.handleLogin)
	r.Post("/logout", s.handleLogout)
	r.With(auth.RequirePlatformAuth).Get("/me", s.handleMe)
	r.With(auth.RequirePlatformAuth).Get("/tenants", s.handleListTenants)
	r.With(auth.RequirePlatformAuth).Get("/tenants/{id}", s.handleGetTenant)
	r.With(auth.RequirePlatformAuth).Get("/admins", s.handleListAdmins)
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8086"
	}
	log.Printf("platform-admin-service listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}
