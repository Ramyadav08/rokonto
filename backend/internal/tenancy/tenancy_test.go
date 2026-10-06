package tenancy

import "testing"

func TestScopePromQL(t *testing.T) {
	cases := []struct {
		name    string
		query   string
		want    string
		wantErr bool
	}{
		{
			name:  "bare metric name",
			query: `up`,
			want:  `up{cluster=~"c1|c2"}`,
		},
		{
			name:  "existing selector gets AND'd, not replaced",
			query: `container_cpu_usage_seconds_total{namespace="nginx"}`,
			want:  `container_cpu_usage_seconds_total{cluster=~"c1|c2",namespace="nginx"}`,
		},
		{
			name:  "aggregation wraps every selector inside it",
			query: `sum(up) by (job) / sum(kube_pod_info) by (job)`,
			want:  `sum by (job) (up{cluster=~"c1|c2"}) / sum by (job) (kube_pod_info{cluster=~"c1|c2"})`,
		},
		{
			name:  "attempted spoofed cluster matcher is AND'd, never overridden",
			query: `up{cluster="someone-elses-cluster"}`,
			want:  `up{cluster="someone-elses-cluster",cluster=~"c1|c2"}`,
		},
		{
			name:    "no clusters means no query is servable",
			query:   `up`,
			wantErr: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			clusters := []string{"c1", "c2"}
			if tc.wantErr {
				clusters = nil
			}
			got, err := ScopePromQL(tc.query, clusters, nil)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error, got %q", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.want {
				t.Fatalf("got  %s\nwant %s", got, tc.want)
			}
		})
	}
}

// A matcher with the spoofed literal "cluster=" value never actually
// matches anything real once AND'd with the regex allow-list unless the
// spoofed value happens to be in the allow-list -- Prometheus evaluates all
// matchers as an intersection. This test documents that the injected
// matcher makes the query strictly narrower, never wider, which is the
// actual security property this package exists to provide.
func TestScopePromQL_NamespaceScoped(t *testing.T) {
	got, err := ScopePromQL(`up`, []string{"c1"}, []string{"prod-ns"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := `up{cluster=~"c1",namespace=~"prod-ns"}`
	if got != want {
		t.Fatalf("got  %s\nwant %s", got, want)
	}
}

func TestScopeLogQL(t *testing.T) {
	got, err := ScopeLogQL(`{app="api"} | json`, []string{"c1", "c2"}, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := `{app="api", cluster=~"c1|c2"} | json`
	if got != want {
		t.Fatalf("got  %s\nwant %s", got, want)
	}
}

func TestScopeLogQL_EmptySelector(t *testing.T) {
	got, err := ScopeLogQL(`{}`, []string{"c1"}, []string{"prod"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := `{cluster=~"c1", namespace=~"prod"}`
	if got != want {
		t.Fatalf("got  %s\nwant %s", got, want)
	}
}

func TestScopeTraceQL(t *testing.T) {
	got, err := ScopeTraceQL(`{ .http.status_code = 500 }`, []string{"c1"}, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := `{ (.http.status_code = 500) && resource.cluster =~ "c1" }`
	if got != want {
		t.Fatalf("got  %s\nwant %s", got, want)
	}
}
