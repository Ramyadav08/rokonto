// Package tenancy is what makes cross-tenant and cross-cluster data leakage
// structurally impossible rather than merely policy-checked: it's the only
// place that decides the X-Scope-OrgID header sent to Mimir/Loki/Tempo, and
// the only place that rewrites an incoming query to add the caller's
// allowed cluster/namespace matchers.
package tenancy

import (
	"github.com/google/uuid"
)

// OrgIDHeader is the multi-tenancy header Mimir, Loki, and Tempo all read
// natively -- every write and every query is scoped to whatever value this
// carries, with each tenant's data stored under a separate object-storage
// prefix. Never set this from anything a client can influence; it always
// comes from the caller's validated JWT (see internal/auth).
const OrgIDHeader = "X-Scope-OrgID"

func OrgIDForTenant(tenantID uuid.UUID) string {
	return tenantID.String()
}

// Grant is the resolved shape of one row (or the "all namespaces" case) from
// rbac-service's access_grants table -- what query-gateway actually enforces
// against.
type Grant struct {
	ClusterID string
	// nil namespace means "every namespace in this cluster".
	Namespace *string
}

// ClusterIDs returns the distinct set of clusters a grant list touches --
// used to reject a query outright when it references a cluster outside this
// set, before ever reaching the label-matcher injection below.
func ClusterIDs(grants []Grant) map[string]bool {
	set := make(map[string]bool, len(grants))
	for _, g := range grants {
		set[g.ClusterID] = true
	}
	return set
}
