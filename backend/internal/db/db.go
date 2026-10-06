// Package db owns the single Postgres connection pool every service shares
// and the tiny migration runner used at service startup / by the seed CLI.
package db

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Connect(ctx context.Context) (*pgxpool.Pool, error) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		return nil, fmt.Errorf("DATABASE_URL is not set")
	}
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("connecting to postgres: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("pinging postgres: %w", err)
	}
	return pool, nil
}

// Migrate applies every .sql file in fsys, in filename order, inside a
// migrations_applied bookkeeping table so re-running on an already-migrated
// database is a no-op. Deliberately not a general-purpose migration
// framework -- this platform's schema is small and changes rarely enough
// that "run every file once, in order" is the whole requirement.
//
// Takes an fs.FS (the seed CLI passes migrations.FS, an embed.FS) rather
// than a directory path -- a path resolved relative to the source file at
// build time doesn't exist in a container that only ships the compiled
// binary, which is exactly how this broke the first time it ran anywhere
// but a full source checkout.
func Migrate(ctx context.Context, pool *pgxpool.Pool, fsys fs.FS) error {
	if _, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS migrations_applied (
			filename TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`); err != nil {
		return fmt.Errorf("creating migrations_applied table: %w", err)
	}

	entries, err := fs.ReadDir(fsys, ".")
	if err != nil {
		return fmt.Errorf("reading migrations dir: %w", err)
	}
	var files []string
	for _, e := range entries {
		if !e.IsDir() && filepath.Ext(e.Name()) == ".sql" {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)

	for _, name := range files {
		var already bool
		if err := pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM migrations_applied WHERE filename = $1)`, name).Scan(&already); err != nil {
			return fmt.Errorf("checking migration %s: %w", name, err)
		}
		if already {
			continue
		}

		sqlBytes, err := fs.ReadFile(fsys, name)
		if err != nil {
			return fmt.Errorf("reading migration %s: %w", name, err)
		}

		tx, err := pool.Begin(ctx)
		if err != nil {
			return fmt.Errorf("beginning tx for %s: %w", name, err)
		}
		if _, err := tx.Exec(ctx, string(sqlBytes)); err != nil {
			tx.Rollback(ctx)
			return fmt.Errorf("applying migration %s: %w", name, err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO migrations_applied (filename) VALUES ($1)`, name); err != nil {
			tx.Rollback(ctx)
			return fmt.Errorf("recording migration %s: %w", name, err)
		}
		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("committing migration %s: %w", name, err)
		}
	}
	return nil
}
