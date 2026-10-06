-- The original UNIQUE (user_id, cluster_id, namespace_id) constraint never
-- actually prevented duplicate full-cluster grants: Postgres treats every
-- NULL as distinct from every other NULL for uniqueness purposes, so two
-- rows with the same (user_id, cluster_id) and namespace_id = NULL were
-- never considered a conflict. In practice this meant re-running an
-- `ON CONFLICT DO NOTHING` seed/grant insert any number of times kept
-- inserting a "new" row every time instead of being a no-op.
--
-- A partial unique index per case fixes this: one for "every namespace in
-- this cluster" grants (namespace_id IS NULL, where the (user, cluster)
-- pair alone must be unique), and one for namespace-scoped grants (where
-- the full triple must be unique, and NULL isn't involved).
-- Clean up duplicates the old constraint already let through before adding
-- the index that would otherwise fail to create over them.
DELETE FROM access_grants a USING access_grants b
    WHERE a.id > b.id
    AND a.user_id = b.user_id
    AND a.cluster_id = b.cluster_id
    AND a.namespace_id IS NOT DISTINCT FROM b.namespace_id;

ALTER TABLE access_grants DROP CONSTRAINT access_grants_user_id_cluster_id_namespace_id_key;

CREATE UNIQUE INDEX idx_access_grants_full_cluster
    ON access_grants (user_id, cluster_id)
    WHERE namespace_id IS NULL;

CREATE UNIQUE INDEX idx_access_grants_namespace_scoped
    ON access_grants (user_id, cluster_id, namespace_id)
    WHERE namespace_id IS NOT NULL;
