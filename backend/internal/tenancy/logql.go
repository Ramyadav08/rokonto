package tenancy

import (
	"fmt"
	"regexp"
	"strings"
)

// leadingSelector matches LogQL's mandatory leading stream selector, e.g.
// `{app="foo", namespace="bar"} | json`. Every valid LogQL query starts with
// exactly one such block, which is what makes this regex-based injection
// safe here unlike PromQL (which needed a real AST): there's only ever one
// place a stream selector can appear, at the very start of the query.
var leadingSelector = regexp.MustCompile(`^\s*\{([^}]*)\}`)

// ScopeLogQL injects cluster (and optionally namespace) matchers into a
// LogQL query's leading stream selector. Unlike ScopePromQL this isn't an
// AST rewrite -- Loki's LogQL grammar has no public standalone Go parser
// package to build one against -- but the leading-selector shape is fixed
// and simple enough (comma-separated `label="value"` pairs) that string
// injection at that one fixed position is safe.
func ScopeLogQL(query string, clusterIDs []string, namespaces []string) (string, error) {
	if len(clusterIDs) == 0 {
		return "", fmt.Errorf("no accessible clusters for this user")
	}
	loc := leadingSelector.FindStringSubmatchIndex(query)
	if loc == nil {
		return "", fmt.Errorf("query does not start with a LogQL stream selector")
	}

	existing := strings.TrimSpace(query[loc[2]:loc[3]])
	extra := []string{fmt.Sprintf(`cluster=~"%s"`, strings.Join(escapeAll(clusterIDs), "|"))}
	if len(namespaces) > 0 {
		extra = append(extra, fmt.Sprintf(`namespace=~"%s"`, strings.Join(escapeAll(namespaces), "|")))
	}

	combined := strings.Join(extra, ", ")
	if existing != "" {
		combined = existing + ", " + combined
	}

	return "{" + combined + "}" + query[loc[1]:], nil
}
