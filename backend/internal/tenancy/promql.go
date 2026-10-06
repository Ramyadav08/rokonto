package tenancy

import (
	"fmt"
	"strings"

	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/promql/parser"
)

// ScopePromQL parses the query and injects `cluster=~"..."` (and, when the
// grant set is namespace-scoped for every allowed cluster, `namespace=~"..."`)
// into every vector/matrix selector in the AST, then returns the rewritten
// query string. This is the same technique prom-label-proxy uses for
// multi-tenant Prometheus: rewriting the parsed AST rather than the raw
// query text is what makes it safe against someone trying to smuggle their
// own conflicting `cluster=` matcher into the query -- an AND'd regex
// matcher on an already-restrictive label can only narrow results, never
// widen them, regardless of what the user's query also asks for.
//
// clusterIDs and namespaces (empty namespaces = no namespace restriction,
// i.e. every namespace in the allowed clusters) come from the caller's
// resolved access_grants -- see rbac-service.
func ScopePromQL(query string, clusterIDs []string, namespaces []string) (string, error) {
	if len(clusterIDs) == 0 {
		return "", fmt.Errorf("no accessible clusters for this user")
	}

	expr, err := parser.NewParser(parser.Options{}).ParseExpr(query)
	if err != nil {
		return "", fmt.Errorf("parsing PromQL: %w", err)
	}

	extra := []*labels.Matcher{
		mustRegexMatcher("cluster", clusterIDs),
	}
	if len(namespaces) > 0 {
		extra = append(extra, mustRegexMatcher("namespace", namespaces))
	}

	parser.Inspect(expr, func(node parser.Node, _ []parser.Node) error {
		if vs, ok := node.(*parser.VectorSelector); ok {
			vs.LabelMatchers = append(vs.LabelMatchers, extra...)
		}
		return nil
	})

	return expr.String(), nil
}

// RegexAlternation builds a `v1|v2|...` regex, with every value escaped so a
// cluster/namespace name containing a regex metacharacter can't accidentally
// (or deliberately, if one were ever user-suppliable) widen the match. Used
// everywhere a caller's allowed cluster/namespace set needs to become a
// label matcher -- PromQL, LogQL, TraceQL, and Alertmanager's filter params
// all accept this same "regex OR" shape.
func RegexAlternation(values []string) string {
	return strings.Join(escapeAll(values), "|")
}

func mustRegexMatcher(label string, values []string) *labels.Matcher {
	m, err := labels.NewMatcher(labels.MatchRegexp, label, RegexAlternation(values))
	if err != nil {
		// Values are our own cluster/namespace names (from Postgres, never
		// raw user input at this point), so a regex compile failure here
		// would mean a corrupt access grant, not a bad request -- panic is
		// appropriate rather than silently under-scoping a query.
		panic(fmt.Sprintf("building label matcher for %s: %v", label, err))
	}
	return m
}

func escapeAll(values []string) []string {
	out := make([]string, len(values))
	for i, v := range values {
		out[i] = regexpQuoteMeta(v)
	}
	return out
}

// regexpQuoteMeta avoids importing regexp just for QuoteMeta's one line.
func regexpQuoteMeta(s string) string {
	var b strings.Builder
	for _, r := range s {
		if strings.ContainsRune(`\.+*?()|[]{}^$`, r) {
			b.WriteByte('\\')
		}
		b.WriteRune(r)
	}
	return b.String()
}
