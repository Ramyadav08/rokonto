package tenancy

import (
	"fmt"
	"regexp"
	"strings"
)

// leadingSpanset matches a TraceQL query's first (and, for every query this
// platform's UI actually generates, only) spanset filter, e.g.
// `{ .http.status_code = 500 }` or `{}`. TraceQL supports combining several
// spansets with `&&`/`||`/structural operators, which this deliberately
// does not attempt to handle -- same trade-off as LogQL above: no
// standalone TraceQL parser package exists to build a real AST rewrite
// against, so this covers the common single-spanset case honestly rather
// than half-covering the general one.
var leadingSpanset = regexp.MustCompile(`^\s*\{([^}]*)\}`)

func ScopeTraceQL(query string, clusterIDs []string, namespaces []string) (string, error) {
	if len(clusterIDs) == 0 {
		return "", fmt.Errorf("no accessible clusters for this user")
	}
	loc := leadingSpanset.FindStringSubmatchIndex(query)
	if loc == nil {
		return "", fmt.Errorf("query does not start with a TraceQL spanset filter")
	}

	existing := strings.TrimSpace(query[loc[2]:loc[3]])
	conditions := []string{fmt.Sprintf(`resource.cluster =~ "%s"`, strings.Join(escapeAll(clusterIDs), "|"))}
	if len(namespaces) > 0 {
		conditions = append(conditions, fmt.Sprintf(`resource.namespace =~ "%s"`, strings.Join(escapeAll(namespaces), "|")))
	}
	if existing != "" {
		conditions = append([]string{"(" + existing + ")"}, conditions...)
	}

	return "{ " + strings.Join(conditions, " && ") + " }" + query[loc[1]:], nil
}
