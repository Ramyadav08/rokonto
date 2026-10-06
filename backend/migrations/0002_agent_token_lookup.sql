-- Adds a fast, O(1)-indexed lookup path for resolving an incoming agent
-- bearer token to its cluster row. agent_token_hash is bcrypt, which is
-- intentionally non-deterministic (same input hashes differently each time),
-- so it can never be looked up by equality -- only compared one row at a
-- time via auth.CheckAgentToken. agent_token_lookup stores the first 12
-- plaintext characters of the token (~48 bits of its 256 bits of entropy),
-- which narrows a write request to at most one candidate row before the
-- bcrypt comparison confirms it, without ever storing enough of the token to
-- be usable as a credential on its own.
ALTER TABLE clusters ADD COLUMN agent_token_lookup TEXT;
CREATE UNIQUE INDEX idx_clusters_agent_token_lookup ON clusters(agent_token_lookup) WHERE agent_token_lookup IS NOT NULL;
