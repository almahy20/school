-- ==========================================================================
-- Migration: 20260807170000_enable_pg_net_and_seed_vault.sql
-- Step     : #6 from the push-notification setup (see docs/PUSH_NOTIFICATIONS_VERCEL_SETUP.md)
-- Purpose  : 1) Ensure the `pg_net` extension is ENABLED so that triggers can
--               call `net.http_post(...)` against the Edge Function endpoint.
--            2) INSERT the SUPABASE_SERVICE_ROLE_KEY into vault.decrypted_secrets
--               ONLY IF it does NOT already exist there. The trigger function
--               `trigger_push_on_notification_insert` reads this value at runtime.
-- Warning  : NEVER paste the actual service key in this file (repro migrations
--            are committed to the repo). The placeholder value below means:
--               - In HOSTED Supabase: the operator MUST visit
--                 Supabase Dashboard → Vault → Secrets and add a secret named
--                 exactly 'SUPABASE_SERVICE_ROLE_KEY' with the real service_role
--                 key (Project Settings → API → service_role).
--               - In LOCAL dev: this same key should be set in .env as
--                 SUPABASE_SERVICE_ROLE_KEY=...  (the CLI auto-seeds the vault
--                 from the .env entry if configured to do so).
--            If the secret is missing, the trigger gracefully raises a NOTICE
--            and skips push (see trigger source for the NULL check).
-- ==========================================================================

-- ── 1. Enable pg_net extension ────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Make sure the search path of the DB owner can see `net.` functions when the
-- SECURITY DEFINER trigger runs. (Harmless if already set.)
ALTER EXTENSION pg_net UPDATE;

-- ── 2. Vault: insert a PLACEHOLDER secret if the name is missing. ────────
-- The actual secret value MUST be set in:
--     Hosted Supabase → Dashboard → Vault → Secrets → name = 'SUPABASE_SERVICE_ROLE_KEY'
-- DO NOT hardcode the real key here.
INSERT INTO vault.secrets (name, description)
SELECT 'SUPABASE_SERVICE_ROLE_KEY',
       'Service role API key used by trigger_push_on_notification_insert() to auth against the send-push-notification Edge Function.'
WHERE NOT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
);

NOTIFY pgrst, 'reload schema';
