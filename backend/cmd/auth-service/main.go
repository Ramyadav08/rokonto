// auth-service issues and validates sessions. It is the only service that
// ever sees a plaintext password.
package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
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

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginResponse struct {
	Token string `json:"token"`
	User  struct {
		ID       uuid.UUID `json:"id"`
		TenantID uuid.UUID `json:"tenantId"`
		Email    string    `json:"email"`
		Role     string    `json:"role"`
	} `json:"user"`
}

func (s *server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	var (
		id           uuid.UUID
		tenantID     uuid.UUID
		passwordHash string
		role         string
	)
	err := s.pool.QueryRow(r.Context(),
		`SELECT id, tenant_id, password_hash, role FROM users WHERE email = $1`,
		req.Email,
	).Scan(&id, &tenantID, &passwordHash, &role)
	if err != nil {
		// Same response whether the email doesn't exist or the password is
		// wrong -- distinguishing the two lets an attacker enumerate valid
		// emails.
		httpx.Error(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	if !auth.CheckPassword(passwordHash, req.Password) {
		httpx.Error(w, http.StatusUnauthorized, "invalid email or password")
		return
	}

	token, err := auth.IssueToken(id, tenantID, req.Email, role)
	if err != nil {
		log.Printf("issuing token: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not issue session")
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "observex_session",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int((12 * time.Hour).Seconds()),
	})

	resp := loginResponse{Token: token}
	resp.User.ID = id
	resp.User.TenantID = tenantID
	resp.User.Email = req.Email
	resp.User.Role = role
	httpx.JSON(w, http.StatusOK, resp)
}

type signupRequest struct {
	CompanyName string `json:"companyName"`
	Email       string `json:"email"`
	Password    string `json:"password"`
}

var slugDisallowed = regexp.MustCompile(`[^a-z0-9-]+`)

func slugify(name string) string {
	s := strings.ToLower(strings.TrimSpace(name))
	s = slugDisallowed.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if s == "" {
		s = "tenant"
	}
	return s
}

// handleSignup is the self-service path: a brand-new client creates their
// own tenant and becomes its first admin in one shot, no platform staff
// involved. This is the only place outside the seed CLI that ever inserts a
// row into `tenants` -- every other tenant-scoped service only ever reads
// claims.TenantID from an already-issued JWT, never creates the tenant
// itself.
func (s *server) handleSignup(w http.ResponseWriter, r *http.Request) {
	var req signupRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.CompanyName == "" || req.Email == "" || len(req.Password) < 8 {
		httpx.Error(w, http.StatusBadRequest, "companyName, email, and a password of at least 8 characters are required")
		return
	}

	passwordHash, err := auth.HashPassword(req.Password)
	if err != nil {
		log.Printf("hashing password: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not create account")
		return
	}

	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		log.Printf("beginning signup tx: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not create account")
		return
	}
	defer tx.Rollback(r.Context())

	// Base slug from the company name, with a numeric suffix appended until
	// it's actually free -- company names collide far more often than a
	// human picking a username would expect ("Acme", "Acme Inc", "ACME").
	baseSlug := slugify(req.CompanyName)
	slug := baseSlug
	for attempt := 0; ; attempt++ {
		var exists bool
		if err := tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM tenants WHERE slug = $1)`, slug).Scan(&exists); err != nil {
			log.Printf("checking slug: %v", err)
			httpx.Error(w, http.StatusInternalServerError, "could not create account")
			return
		}
		if !exists {
			break
		}
		attempt++
		slug = fmt.Sprintf("%s-%d", baseSlug, attempt+1)
	}

	var tenantID uuid.UUID
	if err := tx.QueryRow(r.Context(),
		`INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id`,
		req.CompanyName, slug,
	).Scan(&tenantID); err != nil {
		log.Printf("creating tenant: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not create account")
		return
	}

	var userID uuid.UUID
	if err := tx.QueryRow(r.Context(),
		`INSERT INTO users (tenant_id, email, password_hash, role) VALUES ($1, $2, $3, 'admin') RETURNING id`,
		tenantID, req.Email, passwordHash,
	).Scan(&userID); err != nil {
		// Most likely a duplicate email within this (brand-new, so really
		// only possible via a race) tenant -- but since the tenant is new,
		// a conflict here in practice means something else went wrong.
		log.Printf("creating admin user: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not create account")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		log.Printf("committing signup: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not create account")
		return
	}

	token, err := auth.IssueToken(userID, tenantID, req.Email, "admin")
	if err != nil {
		log.Printf("issuing token: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "account created, but could not start a session -- please log in")
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "observex_session",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int((12 * time.Hour).Seconds()),
	})

	resp := loginResponse{Token: token}
	resp.User.ID = userID
	resp.User.TenantID = tenantID
	resp.User.Email = req.Email
	resp.User.Role = "admin"
	httpx.JSON(w, http.StatusCreated, resp)
}

func (s *server) handleMe(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "no session")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{
		"id":       claims.UserID.String(),
		"tenantId": claims.TenantID.String(),
		"email":    claims.Email,
		"role":     claims.Role,
	})
}

func (s *server) handleLogout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     "observex_session",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})
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
	r.Post("/login", s.handleLogin)
	r.Post("/signup", s.handleSignup)
	r.Post("/logout", s.handleLogout)
	r.With(auth.RequireAuth).Get("/me", s.handleMe)
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) { httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"}) })

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}
	log.Printf("auth-service listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}
