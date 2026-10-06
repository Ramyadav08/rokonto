// Package migrations embeds the .sql files in this directory into whatever
// binary imports it -- the seed CLI previously located them via a
// runtime.Caller-based relative path, which only worked when run with `go
// run` from a full source checkout and broke the moment it ran as a built
// binary in a container that only ships the compiled output, not the
// migrations/ directory alongside it.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
