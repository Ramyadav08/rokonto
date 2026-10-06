package auth

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// PlatformClaims identifies internal staff (the "our side" panel that
// manages clients and support tickets), never a tenant user. Deliberately
// has no TenantID field at all -- a platform admin isn't scoped to one
// tenant, and giving this struct a tenant field would just invite someone
// to accidentally wire it into tenant-scoped RBAC code later.
type PlatformClaims struct {
	AdminID uuid.UUID `json:"pid"`
	Email   string    `json:"email"`
	jwt.RegisteredClaims
}

// A separate secret from tenant-user JWTs (not just a separate cookie/claims
// shape) -- so a leak of one secret can't be used to forge the other kind of
// session, and the two token spaces can't cross-validate even by accident.
func platformSecret() ([]byte, error) {
	s := os.Getenv("PLATFORM_JWT_SECRET")
	if s == "" {
		return nil, errors.New("PLATFORM_JWT_SECRET is not set")
	}
	return []byte(s), nil
}

func IssuePlatformToken(adminID uuid.UUID, email string) (string, error) {
	key, err := platformSecret()
	if err != nil {
		return "", err
	}
	claims := PlatformClaims{
		AdminID: adminID,
		Email:   email,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(accessTokenTTL)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(key)
}

func ParsePlatformToken(raw string) (*PlatformClaims, error) {
	key, err := platformSecret()
	if err != nil {
		return nil, err
	}
	claims := &PlatformClaims{}
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

type platformCtxKey struct{}

// PlatformSessionCookie is a different cookie name from the tenant session
// ("observex_session") on purpose -- a browser authenticated as platform
// staff and one authenticated as a tenant user can never collide or be
// confused for each other, even if both panels somehow shared an origin.
const PlatformSessionCookie = "observex_platform_session"

// RequirePlatformAuth mirrors RequireAuth exactly, but for platform staff:
// reads PlatformSessionCookie or a Bearer header, validates against the
// platform-only secret, and stores PlatformClaims (never Claims) on the
// context.
func RequirePlatformAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw := bearerToken(r)
		if raw == "" {
			if c, err := r.Cookie(PlatformSessionCookie); err == nil {
				raw = c.Value
			}
		}
		if raw == "" {
			http.Error(w, "missing credentials", http.StatusUnauthorized)
			return
		}
		claims, err := ParsePlatformToken(raw)
		if err != nil {
			http.Error(w, "invalid or expired session", http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), platformCtxKey{}, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func PlatformFromContext(ctx context.Context) (*PlatformClaims, bool) {
	c, ok := ctx.Value(platformCtxKey{}).(*PlatformClaims)
	return c, ok
}
