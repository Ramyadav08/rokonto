// support-service is the one place in the backend that accepts both kinds of
// session at once: tenant-side users create/view their own tenant's support
// tickets under auth.RequireAuth, while platform staff triage tickets across
// every tenant under auth.RequirePlatformAuth on a completely separate set of
// routes. The two auth systems are never mixed within a single handler.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
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

func validStatus(s string) bool {
	switch s {
	case "open", "pending", "resolved", "closed":
		return true
	}
	return false
}

func validPriority(p string) bool {
	switch p {
	case "low", "normal", "high", "urgent":
		return true
	}
	return false
}

// ticketResponse covers both the tenant-side and platform-side shapes.
// TenantName is only populated where the handler joins tenants (platform
// routes) and is omitted from the tenant-side JSON (the caller already knows
// their own tenant) via omitempty.
type ticketResponse struct {
	ID             uuid.UUID  `json:"id"`
	TenantID       uuid.UUID  `json:"tenantId"`
	TenantName     string     `json:"tenantName,omitempty"`
	CreatedBy      uuid.UUID  `json:"createdBy"`
	CreatedByEmail string     `json:"createdByEmail,omitempty"`
	Subject        string     `json:"subject"`
	Description    string     `json:"description"`
	Status         string     `json:"status"`
	Priority       string     `json:"priority"`
	AssignedTo     *uuid.UUID `json:"assignedTo"`
	CreatedAt      string     `json:"createdAt"`
	UpdatedAt      string     `json:"updatedAt"`
}

type commentResponse struct {
	ID          uuid.UUID `json:"id"`
	AuthorType  string    `json:"authorType"` // "user" or "platform_admin"
	AuthorEmail string    `json:"authorEmail"`
	Body        string    `json:"body"`
	CreatedAt   string    `json:"createdAt"`
}

type ticketDetailResponse struct {
	ticketResponse
	Comments []commentResponse `json:"comments"`
}

// ---------- tenant-side handlers (auth.RequireAuth) ----------

type createTicketRequest struct {
	Subject     string `json:"subject"`
	Description string `json:"description"`
	Priority    string `json:"priority"`
}

func (s *server) handleCreateTicket(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "no session")
		return
	}

	var req createTicketRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Subject == "" || req.Description == "" {
		httpx.Error(w, http.StatusBadRequest, "subject and description are required")
		return
	}
	if req.Priority != "" && !validPriority(req.Priority) {
		httpx.Error(w, http.StatusBadRequest, "priority must be one of low, normal, high, urgent")
		return
	}

	var (
		id                   uuid.UUID
		status, priority     string
		createdAt, updatedAt time.Time
		err                  error
	)
	if req.Priority == "" {
		err = s.pool.QueryRow(r.Context(),
			`INSERT INTO support_tickets (tenant_id, created_by, subject, description)
			 VALUES ($1, $2, $3, $4)
			 RETURNING id, status, priority, created_at, updated_at`,
			claims.TenantID, claims.UserID, req.Subject, req.Description,
		).Scan(&id, &status, &priority, &createdAt, &updatedAt)
	} else {
		err = s.pool.QueryRow(r.Context(),
			`INSERT INTO support_tickets (tenant_id, created_by, subject, description, priority)
			 VALUES ($1, $2, $3, $4, $5)
			 RETURNING id, status, priority, created_at, updated_at`,
			claims.TenantID, claims.UserID, req.Subject, req.Description, req.Priority,
		).Scan(&id, &status, &priority, &createdAt, &updatedAt)
	}
	if err != nil {
		log.Printf("creating ticket: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not create ticket")
		return
	}

	httpx.JSON(w, http.StatusCreated, ticketResponse{
		ID:             id,
		TenantID:       claims.TenantID,
		CreatedBy:      claims.UserID,
		CreatedByEmail: claims.Email,
		Subject:        req.Subject,
		Description:    req.Description,
		Status:         status,
		Priority:       priority,
		AssignedTo:     nil,
		CreatedAt:      createdAt.Format(time.RFC3339),
		UpdatedAt:      updatedAt.Format(time.RFC3339),
	})
}

func (s *server) handleListTickets(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "no session")
		return
	}

	rows, err := s.pool.Query(r.Context(),
		`SELECT t.id, t.tenant_id, t.created_by, u.email, t.subject, t.description,
		        t.status, t.priority, t.assigned_to, t.created_at, t.updated_at
		 FROM support_tickets t
		 JOIN users u ON u.id = t.created_by
		 WHERE t.tenant_id = $1
		 ORDER BY t.created_at DESC`,
		claims.TenantID,
	)
	if err != nil {
		log.Printf("listing tickets: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not list tickets")
		return
	}
	defer rows.Close()

	tickets := []ticketResponse{}
	for rows.Next() {
		var (
			t                    ticketResponse
			createdAt, updatedAt time.Time
		)
		if err := rows.Scan(&t.ID, &t.TenantID, &t.CreatedBy, &t.CreatedByEmail, &t.Subject,
			&t.Description, &t.Status, &t.Priority, &t.AssignedTo, &createdAt, &updatedAt); err != nil {
			log.Printf("scanning ticket: %v", err)
			httpx.Error(w, http.StatusInternalServerError, "could not list tickets")
			return
		}
		t.CreatedAt = createdAt.Format(time.RFC3339)
		t.UpdatedAt = updatedAt.Format(time.RFC3339)
		tickets = append(tickets, t)
	}
	if err := rows.Err(); err != nil {
		log.Printf("iterating tickets: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not list tickets")
		return
	}

	httpx.JSON(w, http.StatusOK, tickets)
}

// fetchComments loads every comment on a ticket, newest-last, resolving each
// author against whichever single FK column is actually set.
func (s *server) fetchComments(ctx context.Context, ticketID uuid.UUID) ([]commentResponse, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT c.id, c.body, c.created_at, c.author_user_id, u.email, c.author_platform_admin_id, pa.email
		 FROM support_ticket_comments c
		 LEFT JOIN users u ON u.id = c.author_user_id
		 LEFT JOIN platform_admins pa ON pa.id = c.author_platform_admin_id
		 WHERE c.ticket_id = $1
		 ORDER BY c.created_at ASC`,
		ticketID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	comments := []commentResponse{}
	for rows.Next() {
		var (
			c             commentResponse
			createdAt     time.Time
			authorUserID  *uuid.UUID
			userEmail     *string
			authorAdminID *uuid.UUID
			adminEmail    *string
		)
		if err := rows.Scan(&c.ID, &c.Body, &createdAt, &authorUserID, &userEmail, &authorAdminID, &adminEmail); err != nil {
			return nil, err
		}
		c.CreatedAt = createdAt.Format(time.RFC3339)
		if authorUserID != nil {
			c.AuthorType = "user"
			if userEmail != nil {
				c.AuthorEmail = *userEmail
			}
		} else {
			c.AuthorType = "platform_admin"
			if adminEmail != nil {
				c.AuthorEmail = *adminEmail
			}
		}
		comments = append(comments, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return comments, nil
}

// fetchTicket loads a single ticket joined with its tenant name and creating
// user's email. When tenantID is non-nil, the WHERE clause itself is scoped
// by it -- the scope check IS the query, not a separate lookup a caller
// could skip. Returns pgx.ErrNoRows (via Scan) when not found/not owned.
func (s *server) fetchTicket(ctx context.Context, ticketID uuid.UUID, tenantID *uuid.UUID) (ticketResponse, error) {
	var (
		t                    ticketResponse
		createdAt, updatedAt time.Time
	)
	query := `SELECT t.id, t.tenant_id, tn.name, t.created_by, u.email, t.subject, t.description,
	                 t.status, t.priority, t.assigned_to, t.created_at, t.updated_at
	          FROM support_tickets t
	          JOIN tenants tn ON tn.id = t.tenant_id
	          JOIN users u ON u.id = t.created_by
	          WHERE t.id = $1`
	args := []interface{}{ticketID}
	if tenantID != nil {
		query += ` AND t.tenant_id = $2`
		args = append(args, *tenantID)
	}
	err := s.pool.QueryRow(ctx, query, args...).Scan(
		&t.ID, &t.TenantID, &t.TenantName, &t.CreatedBy, &t.CreatedByEmail, &t.Subject,
		&t.Description, &t.Status, &t.Priority, &t.AssignedTo, &createdAt, &updatedAt,
	)
	if err != nil {
		return ticketResponse{}, err
	}
	t.CreatedAt = createdAt.Format(time.RFC3339)
	t.UpdatedAt = updatedAt.Format(time.RFC3339)
	return t, nil
}

func (s *server) handleGetTicket(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "no session")
		return
	}

	ticketID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid ticket id")
		return
	}

	// Scoped by tenant_id in the query itself -- a tenant user must never be
	// able to fetch another tenant's ticket by guessing its UUID.
	t, err := s.fetchTicket(r.Context(), ticketID, &claims.TenantID)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "ticket not found")
		return
	}
	if err != nil {
		log.Printf("fetching ticket: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not fetch ticket")
		return
	}
	t.TenantName = "" // not part of the tenant-side contract

	comments, err := s.fetchComments(r.Context(), ticketID)
	if err != nil {
		log.Printf("fetching comments: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not fetch ticket")
		return
	}

	httpx.JSON(w, http.StatusOK, ticketDetailResponse{ticketResponse: t, Comments: comments})
}

type createCommentRequest struct {
	Body string `json:"body"`
}

func (s *server) handleCreateTicketComment(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.FromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "no session")
		return
	}

	ticketID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid ticket id")
		return
	}

	var req createCommentRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(req.Body) == "" {
		httpx.Error(w, http.StatusBadRequest, "body is required")
		return
	}

	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		log.Printf("beginning tx: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not add comment")
		return
	}
	defer tx.Rollback(r.Context())

	// Same isolation principle as the detail fetch: verify ownership via the
	// WHERE clause itself before touching the ticket.
	var owns bool
	if err := tx.QueryRow(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM support_tickets WHERE id = $1 AND tenant_id = $2)`,
		ticketID, claims.TenantID,
	).Scan(&owns); err != nil {
		log.Printf("checking ticket ownership: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not add comment")
		return
	}
	if !owns {
		httpx.Error(w, http.StatusNotFound, "ticket not found")
		return
	}

	var (
		commentID uuid.UUID
		createdAt time.Time
	)
	// author_platform_admin_id is deliberately absent from this INSERT (not
	// passed as NULL explicitly, simply never named) so it keeps its column
	// default of NULL while author_user_id is the only one set -- exactly
	// one author, satisfying the one_author CHECK constraint by construction.
	if err := tx.QueryRow(r.Context(),
		`INSERT INTO support_ticket_comments (ticket_id, author_user_id, body)
		 VALUES ($1, $2, $3)
		 RETURNING id, created_at`,
		ticketID, claims.UserID, req.Body,
	).Scan(&commentID, &createdAt); err != nil {
		log.Printf("inserting comment: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not add comment")
		return
	}

	if _, err := tx.Exec(r.Context(),
		`UPDATE support_tickets SET updated_at = now() WHERE id = $1`,
		ticketID,
	); err != nil {
		log.Printf("bumping ticket updated_at: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not add comment")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		log.Printf("committing tx: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not add comment")
		return
	}

	httpx.JSON(w, http.StatusCreated, commentResponse{
		ID:          commentID,
		AuthorType:  "user",
		AuthorEmail: claims.Email,
		Body:        req.Body,
		CreatedAt:   createdAt.Format(time.RFC3339),
	})
}

// ---------- platform-side handlers (auth.RequirePlatformAuth) ----------

func (s *server) handlePlatformListTickets(w http.ResponseWriter, r *http.Request) {
	if _, ok := auth.PlatformFromContext(r.Context()); !ok {
		httpx.Error(w, http.StatusUnauthorized, "no session")
		return
	}

	statusFilter := r.URL.Query().Get("status")
	if statusFilter != "" && !validStatus(statusFilter) {
		httpx.Error(w, http.StatusBadRequest, "status must be one of open, pending, resolved, closed")
		return
	}

	query := `SELECT t.id, t.tenant_id, tn.name, t.created_by, u.email, t.subject, t.description,
	                 t.status, t.priority, t.assigned_to, t.created_at, t.updated_at
	          FROM support_tickets t
	          JOIN tenants tn ON tn.id = t.tenant_id
	          JOIN users u ON u.id = t.created_by`
	args := []interface{}{}
	if statusFilter != "" {
		query += ` WHERE t.status = $1`
		args = append(args, statusFilter)
	}
	query += ` ORDER BY t.updated_at DESC`

	rows, err := s.pool.Query(r.Context(), query, args...)
	if err != nil {
		log.Printf("listing platform tickets: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not list tickets")
		return
	}
	defer rows.Close()

	tickets := []ticketResponse{}
	for rows.Next() {
		var (
			t                    ticketResponse
			createdAt, updatedAt time.Time
		)
		if err := rows.Scan(&t.ID, &t.TenantID, &t.TenantName, &t.CreatedBy, &t.CreatedByEmail, &t.Subject,
			&t.Description, &t.Status, &t.Priority, &t.AssignedTo, &createdAt, &updatedAt); err != nil {
			log.Printf("scanning platform ticket: %v", err)
			httpx.Error(w, http.StatusInternalServerError, "could not list tickets")
			return
		}
		t.CreatedAt = createdAt.Format(time.RFC3339)
		t.UpdatedAt = updatedAt.Format(time.RFC3339)
		tickets = append(tickets, t)
	}
	if err := rows.Err(); err != nil {
		log.Printf("iterating platform tickets: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not list tickets")
		return
	}

	httpx.JSON(w, http.StatusOK, tickets)
}

func (s *server) handlePlatformGetTicket(w http.ResponseWriter, r *http.Request) {
	if _, ok := auth.PlatformFromContext(r.Context()); !ok {
		httpx.Error(w, http.StatusUnauthorized, "no session")
		return
	}

	ticketID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid ticket id")
		return
	}

	// No tenant scoping -- platform staff can see any tenant's ticket.
	t, err := s.fetchTicket(r.Context(), ticketID, nil)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "ticket not found")
		return
	}
	if err != nil {
		log.Printf("fetching ticket: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not fetch ticket")
		return
	}

	comments, err := s.fetchComments(r.Context(), ticketID)
	if err != nil {
		log.Printf("fetching comments: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not fetch ticket")
		return
	}

	httpx.JSON(w, http.StatusOK, ticketDetailResponse{ticketResponse: t, Comments: comments})
}

func (s *server) handlePlatformCreateTicketComment(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.PlatformFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "no session")
		return
	}

	ticketID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid ticket id")
		return
	}

	var req createCommentRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(req.Body) == "" {
		httpx.Error(w, http.StatusBadRequest, "body is required")
		return
	}

	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		log.Printf("beginning tx: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not add comment")
		return
	}
	defer tx.Rollback(r.Context())

	var exists bool
	if err := tx.QueryRow(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM support_tickets WHERE id = $1)`,
		ticketID,
	).Scan(&exists); err != nil {
		log.Printf("checking ticket existence: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not add comment")
		return
	}
	if !exists {
		httpx.Error(w, http.StatusNotFound, "ticket not found")
		return
	}

	var (
		commentID uuid.UUID
		createdAt time.Time
	)
	// Mirror image of the tenant-side insert: author_user_id is left unnamed
	// (stays NULL by column default) and only author_platform_admin_id is
	// set, so exactly one author column is ever populated here too.
	if err := tx.QueryRow(r.Context(),
		`INSERT INTO support_ticket_comments (ticket_id, author_platform_admin_id, body)
		 VALUES ($1, $2, $3)
		 RETURNING id, created_at`,
		ticketID, claims.AdminID, req.Body,
	).Scan(&commentID, &createdAt); err != nil {
		log.Printf("inserting comment: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not add comment")
		return
	}

	if _, err := tx.Exec(r.Context(),
		`UPDATE support_tickets SET updated_at = now() WHERE id = $1`,
		ticketID,
	); err != nil {
		log.Printf("bumping ticket updated_at: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not add comment")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		log.Printf("committing tx: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not add comment")
		return
	}

	httpx.JSON(w, http.StatusCreated, commentResponse{
		ID:          commentID,
		AuthorType:  "platform_admin",
		AuthorEmail: claims.Email,
		Body:        req.Body,
		CreatedAt:   createdAt.Format(time.RFC3339),
	})
}

// handlePlatformPatchTicket decodes into a map[string]json.RawMessage
// (rather than a plain struct) specifically so it can tell "assignedTo
// absent" apart from "assignedTo explicitly null" -- a plain *uuid.UUID
// field can't distinguish those two cases, but a partial update needs to:
// absent means "leave assigned_to alone", explicit null means "unassign".
func (s *server) handlePlatformPatchTicket(w http.ResponseWriter, r *http.Request) {
	if _, ok := auth.PlatformFromContext(r.Context()); !ok {
		httpx.Error(w, http.StatusUnauthorized, "no session")
		return
	}

	ticketID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid ticket id")
		return
	}

	var raw map[string]json.RawMessage
	defer r.Body.Close()
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	allowed := map[string]bool{"status": true, "assignedTo": true, "priority": true}
	for k := range raw {
		if !allowed[k] {
			httpx.Error(w, http.StatusBadRequest, fmt.Sprintf("unknown field %q", k))
			return
		}
	}
	if len(raw) == 0 {
		httpx.Error(w, http.StatusBadRequest, "no fields to update")
		return
	}

	setParts := []string{"updated_at = now()"}
	args := []interface{}{ticketID}

	if v, ok := raw["status"]; ok {
		var status string
		if err := json.Unmarshal(v, &status); err != nil || !validStatus(status) {
			httpx.Error(w, http.StatusBadRequest, "status must be one of open, pending, resolved, closed")
			return
		}
		args = append(args, status)
		setParts = append(setParts, fmt.Sprintf("status = $%d", len(args)))
	}

	if v, ok := raw["priority"]; ok {
		var priority string
		if err := json.Unmarshal(v, &priority); err != nil || !validPriority(priority) {
			httpx.Error(w, http.StatusBadRequest, "priority must be one of low, normal, high, urgent")
			return
		}
		args = append(args, priority)
		setParts = append(setParts, fmt.Sprintf("priority = $%d", len(args)))
	}

	if v, ok := raw["assignedTo"]; ok {
		if string(v) == "null" {
			args = append(args, nil)
		} else {
			var adminID uuid.UUID
			if err := json.Unmarshal(v, &adminID); err != nil {
				httpx.Error(w, http.StatusBadRequest, "assignedTo must be a UUID or null")
				return
			}
			args = append(args, adminID)
		}
		setParts = append(setParts, fmt.Sprintf("assigned_to = $%d", len(args)))
	}

	query := fmt.Sprintf(
		`UPDATE support_tickets SET %s WHERE id = $1
		 RETURNING id, tenant_id, created_by, subject, description, status, priority, assigned_to, created_at, updated_at`,
		strings.Join(setParts, ", "),
	)

	var (
		t                    ticketResponse
		createdAt, updatedAt time.Time
	)
	err = s.pool.QueryRow(r.Context(), query, args...).Scan(
		&t.ID, &t.TenantID, &t.CreatedBy, &t.Subject, &t.Description,
		&t.Status, &t.Priority, &t.AssignedTo, &createdAt, &updatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "ticket not found")
		return
	}
	if err != nil {
		log.Printf("patching ticket: %v", err)
		httpx.Error(w, http.StatusInternalServerError, "could not update ticket")
		return
	}
	t.CreatedAt = createdAt.Format(time.RFC3339)
	t.UpdatedAt = updatedAt.Format(time.RFC3339)

	httpx.JSON(w, http.StatusOK, t)
}

func main() {
	ctx := context.Background()

	if os.Getenv("JWT_SECRET") == "" {
		log.Fatal("JWT_SECRET is not set")
	}
	if os.Getenv("PLATFORM_JWT_SECRET") == "" {
		log.Fatal("PLATFORM_JWT_SECRET is not set")
	}

	pool, err := db.Connect(ctx)
	if err != nil {
		log.Fatalf("connecting to database: %v", err)
	}
	defer pool.Close()

	s := &server{pool: pool}

	r := chi.NewRouter()

	// Tenant-side routes: a client's own staff, scoped to their tenant.
	r.With(auth.RequireAuth).Post("/tickets", s.handleCreateTicket)
	r.With(auth.RequireAuth).Get("/tickets", s.handleListTickets)
	r.With(auth.RequireAuth).Get("/tickets/{id}", s.handleGetTicket)
	r.With(auth.RequireAuth).Post("/tickets/{id}/comments", s.handleCreateTicketComment)

	// Platform-side routes: Observex's internal ops/support staff, not
	// scoped to any tenant.
	r.With(auth.RequirePlatformAuth).Get("/platform/tickets", s.handlePlatformListTickets)
	r.With(auth.RequirePlatformAuth).Get("/platform/tickets/{id}", s.handlePlatformGetTicket)
	r.With(auth.RequirePlatformAuth).Post("/platform/tickets/{id}/comments", s.handlePlatformCreateTicketComment)
	r.With(auth.RequirePlatformAuth).Patch("/platform/tickets/{id}", s.handlePlatformPatchTicket)

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8087"
	}
	log.Printf("support-service listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}
