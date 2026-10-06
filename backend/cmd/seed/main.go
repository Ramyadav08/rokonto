// seed is a one-shot CLI: runs migrations, then creates a demo tenant
// ("alyssum"), one dev cluster, and one admin user, so there's something to
// log in as and test against on first boot. Safe to re-run -- migrations
// are idempotent and the demo tenant is looked up by slug before creating.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"

	"github.com/google/uuid"

	"observex/backend/internal/auth"
	"observex/backend/internal/db"
	"observex/backend/migrations"
)

func main() {
	adminEmail := flag.String("admin-email", "admin@alyssum.example", "email for the seeded admin user")
	adminPassword := flag.String("admin-password", "", "password for the seeded admin user (required)")
	flag.Parse()

	if *adminPassword == "" {
		log.Fatal("--admin-password is required")
	}

	ctx := context.Background()
	pool, err := db.Connect(ctx)
	if err != nil {
		log.Fatalf("connecting to database: %v", err)
	}
	defer pool.Close()

	if err := db.Migrate(ctx, pool, migrations.FS); err != nil {
		log.Fatalf("running migrations: %v", err)
	}

	var tenantID uuid.UUID
	err = pool.QueryRow(ctx, `SELECT id FROM tenants WHERE slug = 'alyssum'`).Scan(&tenantID)
	if err != nil {
		err = pool.QueryRow(ctx,
			`INSERT INTO tenants (name, slug) VALUES ('Alyssum', 'alyssum') RETURNING id`,
		).Scan(&tenantID)
		if err != nil {
			log.Fatalf("creating tenant: %v", err)
		}
		fmt.Printf("created tenant alyssum (%s)\n", tenantID)
	} else {
		fmt.Printf("tenant alyssum already exists (%s)\n", tenantID)
	}

	var clusterID uuid.UUID
	err = pool.QueryRow(ctx, `SELECT id FROM clusters WHERE tenant_id = $1 AND name = 'dev-1'`, tenantID).Scan(&clusterID)
	if err != nil {
		plainToken, tokenHash, terr := auth.GenerateAgentToken()
		if terr != nil {
			log.Fatalf("generating agent token: %v", terr)
		}
		err = pool.QueryRow(ctx,
			`INSERT INTO clusters (tenant_id, name, env, agent_token_hash, agent_token_lookup) VALUES ($1, 'dev-1', 'dev', $2, $3) RETURNING id`,
			tenantID, tokenHash, plainToken[:12],
		).Scan(&clusterID)
		if err != nil {
			log.Fatalf("creating cluster: %v", err)
		}
		fmt.Printf("created cluster dev-1 (%s)\n", clusterID)
		fmt.Printf("AGENT TOKEN (save this now, it will not be shown again): %s\n", plainToken)
	} else {
		fmt.Printf("cluster dev-1 already exists (%s)\n", clusterID)
	}

	passwordHash, err := auth.HashPassword(*adminPassword)
	if err != nil {
		log.Fatalf("hashing admin password: %v", err)
	}
	var userID uuid.UUID
	err = pool.QueryRow(ctx,
		`INSERT INTO users (tenant_id, email, password_hash, role) VALUES ($1, $2, $3, 'admin')
		 ON CONFLICT (tenant_id, email) DO UPDATE SET password_hash = EXCLUDED.password_hash
		 RETURNING id`,
		tenantID, *adminEmail, passwordHash,
	).Scan(&userID)
	if err != nil {
		log.Fatalf("creating admin user: %v", err)
	}
	fmt.Printf("admin user ready: %s (%s)\n", *adminEmail, userID)

	// Admin gets full access to the seeded cluster (no namespace_id = every
	// namespace) so there's something to see immediately after logging in.
	if _, err := pool.Exec(ctx,
		`INSERT INTO access_grants (user_id, cluster_id, namespace_id) VALUES ($1, $2, NULL)
		 ON CONFLICT (user_id, cluster_id) WHERE namespace_id IS NULL DO NOTHING`,
		userID, clusterID,
	); err != nil {
		log.Fatalf("granting admin access: %v", err)
	}

	fmt.Println("seed complete")
}
