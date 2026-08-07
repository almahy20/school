-- Minimal, idempotent migration: ensure pg_net is enabled and the vault
-- secret name for the service role exists. We keep both operations fully
-- atomic & safe to replay.

-- ── Enable pg_net (required for net.http_post inside triggers) ──
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
    ) THEN
        CREATE EXTENSION pg_net WITH SCHEMA extensions;
    END IF;
END $$;

-- ── Vault: ensure secret NAME is seeded (value = set by operator in UI) ──
INSERT INTO vault.secrets (name, description)
SELECT name, description FROM (
    SELECT
        'SUPABASE_SERVICE_ROLE_KEY'::text AS name,
        'Service role key used by trigger_push_on_notification_insert (DO NOT hardcode value in migrations — set it via the Dashboard Vault UI).'::text AS description
) seed
WHERE NOT EXISTS (
    SELECT 1 FROM vault.secrets s WHERE s.name = seed.name
);
