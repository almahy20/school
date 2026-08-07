-- Migration: 20260807170200_enable_pg_net_only.sql
-- Purpose  : Enable the pg_net extension so that PL/pgSQL triggers can call
--            `net.http_post(...)` (used by trigger_push_on_notification_insert to
--            invoke the send-push-notification Edge Function).
-- NOTE about Vault secrets:
--   The `SUPABASE_SERVICE_ROLE_KEY` secret must be added MANUALLY via the
--   Supabase Dashboard UI (Project → Vault → Secrets → Add Secret) because
--   the Vault extension does not allow seeding encrypted values through plain
--   SQL migrations. Steps:
--       1) Copy the service_role key from:
--              Dashboard → Project Settings → API → service_role (copy)
--       2) Paste it into:
--              Dashboard → Vault → Secrets → Add Secret
--                  Name     : SUPABASE_SERVICE_ROLE_KEY
--                  Secret   : <paste the service_role key>
--                  Key ID   : (leave default / primary)
--   The trigger already has a NULL guard with a NOTICE if the key is missing.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
