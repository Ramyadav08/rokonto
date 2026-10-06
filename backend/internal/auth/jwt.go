// Package auth is the one place JWTs are issued and validated. Every
// service imports this instead of touching a JWT library directly, so the
// claim shape (and the secret) can never drift between services.
package auth

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Claims carries exactly what every downstream service needs to enforce
// tenancy and RBAC -- most importantly, TenantID never comes from anywhere
// else. A handler that trusted a client-supplied tenant ID instead of this
// claim is how cross-tenant data leaks happen; there is deliberately no
// other code path that produces a tenant scope.
type Claims struct {
	UserID   uuid.UUID `json:"uid"`
	TenantID uuid.UUID `json:"tid"`
	Email    string    `json:"email"`
	Role     string    `json:"role"`
	jwt.RegisteredClaims
}

const accessTokenTTL = 12 * time.Hour

func secret() ([]byte, error) {
	s := os.Getenv("JWT_SECRET")
	if s == "" {
		return nil, errors.New("JWT_SECRET is not set")
	}
	return []byte(s), nil
}

func IssueToken(userID, tenantID uuid.UUID, email, role string) (string, error) {
	key, err := secret()
	if err != nil {
		return "", err
	}
	claims := Claims{
		UserID:   userID,
		TenantID: tenantID,
		Email:    email,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(accessTokenTTL)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(key)
}

func ParseToken(raw string) (*Claims, error) {
	key, err := secret()
	if err != nil {
		return nil, err
	}
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(raw, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return key, nil
	})
	if err != nil || !token.Valid {
		return nil, fmt.Errorf("invalid token: %w", err)
	}
	return claims, nil
}

type ctxKey struct{}

// RequireAuth reads the JWT from either the "observex_session" httpOnly
// cookie (used by browser requests via the Next.js BFF) or a Bearer header
// (used by service-to-service calls), and stores the parsed Claims on the
// request context for downstream handlers via FromContext.
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw := bearerToken(r)
		if raw == "" {
			if c, err := r.Cookie("observex_session"); err == nil {
				raw = c.Value
			}
		}
		if raw == "" {
			http.Error(w, "missing credentials", http.StatusUnauthorized)
			return
		}
		claims, err := ParseToken(raw)
		if err != nil {
			http.Error(w, "invalid or expired session", http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), ctxKey{}, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func bearerToken(r *http.Request) string {
	h := r.Header.Get("Authorization")
	if strings.HasPrefix(h, "Bearer ") {
		return strings.TrimPrefix(h, "Bearer ")
	}
	return ""
}

func FromContext(ctx context.Context) (*Claims, bool) {
	c, ok := ctx.Value(ctxKey{}).(*Claims)
	return c, ok
}
