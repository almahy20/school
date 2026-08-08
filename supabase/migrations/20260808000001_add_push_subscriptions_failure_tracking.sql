-- ==========================================================================
-- Migration: 20260808000001_add_push_subscriptions_failure_tracking.sql
-- Step     : #1 — Schema Prep for Push Notification Reliability Fixes
-- Purpose  : 1) Add missing `user_agent` column to push_subscriptions so
--               send-push-notification EF no longer throws 500 on select.
--            2) Add `failure_count`, `last_failure_at`, `last_failure_code`
--               columns so the 3-strike rule for 403 VAPID mismatches works.
--            3) Create `push_trigger_errors` table — permanent logging for
--               when the pg_net trigger cannot run (vault key missing, etc)
--               instead of a NOTICE that disappears forever.
--            4) Create `push_delivery_log` table — links every notification
--               insert to its pg_net request_id so we can JOIN against
--               net._http_response and see what status code the Edge
--               Function actually returned.
-- ==========================================================================

-- ── 1. Add columns to push_subscriptions ─────────────────────────────────
ALTER TABLE public.push_subscriptions
    ADD COLUMN IF NOT EXISTS user_agent TEXT;

ALTER TABLE public.push_subscriptions
    ADD COLUMN IF NOT EXISTS failure_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.push_subscriptions
    ADD COLUMN IF NOT EXISTS last_failure_at TIMESTAMPTZ;

ALTER TABLE public.push_subscriptions
    ADD COLUMN IF NOT EXISTS last_failure_code INTEGER;

ALTER TABLE public.push_subscriptions
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill updated_at for legacy rows
UPDATE public.push_subscriptions
   SET updated_at = COALESCE(last_failure_at, created_at)
 WHERE updated_at IS NULL;

-- ── 2. Push Trigger Errors table ─────────────────────────────────────────
-- Permanent log of every time the trigger SKIPs a push (missing vault key,
-- pg_net unavailable, etc.). Previously this was a RAISE NOTICE that was
-- never persisted anywhere, making "silent" failures impossible to debug.
CREATE TABLE IF NOT EXISTS public.push_trigger_errors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NULL,            -- references public.notifications.id (nullable because it might exist or not at time of error)
    user_id         UUID NULL,            -- convenience, denormalised from notification row
    error_code      TEXT NOT NULL,        -- short stable code: 'VAULT_KEY_MISSING', 'PGNET_UNAVAILABLE', 'HTTP_POST_EXCEPTION'
    error_message   TEXT NOT NULL,        -- full human-readable message
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_trigger_errors_created_at
    ON public.push_trigger_errors (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_trigger_errors_code
    ON public.push_trigger_errors (error_code);

-- RLS — only service_role / super_admin write; service_role read.
ALTER TABLE public.push_trigger_errors ENABLE ROW LEVEL SECURITY;

-- (No end-user RLS policies needed — this is a server-side diagnostics table,
--  only populated by the SECURITY DEFINER trigger below and read by admins.)

-- ── 3. Push Delivery Log table ───────────────────────────────────────────
-- Every time the trigger queues a net.http_post() request, it inserts one
-- row here linking the notification to the pg_net request_id.
-- You can then JOIN this with net._http_response after the response comes
-- back to see: status_code, error_msg, response_body, timings, etc.
CREATE TABLE IF NOT EXISTS public.push_delivery_log (
    id                  BIGSERIAL PRIMARY KEY,
    notification_id     UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
    user_id             UUID NULL,
    pg_net_request_id   BIGINT NOT NULL,   -- this is the value returned by net.http_post()
    target_user_id      UUID NULL,
    queued_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_delivery_log_pg_net_request_id
    ON public.push_delivery_log (pg_net_request_id);

CREATE INDEX IF NOT EXISTS idx_push_delivery_log_notification_id
    ON public.push_delivery_log (notification_id);

CREATE INDEX IF NOT EXISTS idx_push_delivery_log_user_id
    ON public.push_delivery_log (target_user_id);

CREATE INDEX IF NOT EXISTS idx_push_delivery_log_queued_at
    ON public.push_delivery_log (queued_at DESC);

ALTER TABLE public.push_delivery_log ENABLE ROW LEVEL SECURITY;

-- (Same as above — SECURITY DEFINER trigger writes, admins read via service role.)

-- ── 4. Convenience view — join delivery log + actual pg_net response ─────
-- Defensive DO block with full EXCEPTION handler so different pg_net
-- versions (different column names) never break the migration.
-- If the full view cannot be built for any reason, we create a minimal one
-- without the net._http_response join so the diagnostics tables are still
-- usable by admins who can just run manual JOINs later.
DO $$
DECLARE
    v_col_created    TEXT := 'NULL::timestamptz';
    v_col_status     TEXT := 'NULL::integer';
    v_col_err        TEXT := 'NULL::text';
    v_col_body       TEXT := 'NULL::text';
    v_join_ok        BOOLEAN := TRUE;
    v_sql            TEXT;
BEGIN
    -- Detect which columns actually exist in pg_net's response table
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='net' AND table_name='_http_response' AND column_name='created') THEN
        v_col_created := 'r.created';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='net' AND table_name='_http_response' AND column_name='status_code') THEN
        v_col_status  := 'r.status_code';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='net' AND table_name='_http_response' AND column_name='error_msg') THEN
        v_col_err     := 'r.error_msg';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='net' AND table_name='_http_response' AND column_name='error') THEN
        v_col_err     := 'r.error';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='net' AND table_name='_http_response' AND column_name='response_body') THEN
        v_col_body    := 'r.response_body';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='net' AND table_name='_http_response' AND column_name='body') THEN
        v_col_body    := 'r.body';
    END IF;

    -- Only do the LEFT JOIN to net._http_response if it actually exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='net' AND table_name='_http_response') THEN
        v_join_ok := FALSE;
    END IF;

    IF v_join_ok THEN
        v_sql := 'CREATE OR REPLACE VIEW public.push_delivery_with_response AS
          SELECT
              dl.id                    AS log_id,
              dl.notification_id,
              dl.target_user_id,
              dl.pg_net_request_id,
              dl.queued_at,
              ' || v_col_created || '  AS response_created,
              ' || v_col_status  || '  AS status_code,
              ' || v_col_err     || '  AS error_msg,
              LEFT(' || v_col_body || ', 1000) AS response_body_preview,
              LEFT(n.title, 80)        AS notification_title,
              LEFT(n.message, 120)     AS notification_message
          FROM public.push_delivery_log dl
          LEFT JOIN net._http_response r ON r.id = dl.pg_net_request_id
          LEFT JOIN public.notifications n  ON n.id = dl.notification_id;';
    ELSE
        v_sql := 'CREATE OR REPLACE VIEW public.push_delivery_with_response AS
          SELECT
              dl.id                    AS log_id,
              dl.notification_id,
              dl.target_user_id,
              dl.pg_net_request_id,
              dl.queued_at,
              NULL::timestamptz        AS response_created,
              NULL::integer            AS status_code,
              NULL::text               AS error_msg,
              NULL::text               AS response_body_preview,
              LEFT(n.title, 80)        AS notification_title,
              LEFT(n.message, 120)     AS notification_message
          FROM public.push_delivery_log dl
          LEFT JOIN public.notifications n ON n.id = dl.notification_id;';
    END IF;

    EXECUTE v_sql;

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'push_delivery_with_response view skipped (pg_net columns unknown): %', SQLERRM;
    -- Minimal fallback without pg_net join — never throws
    EXECUTE 'CREATE OR REPLACE VIEW public.push_delivery_with_response AS
      SELECT
          dl.id                  AS log_id,
          dl.notification_id,
          dl.target_user_id,
          dl.pg_net_request_id,
          dl.queued_at,
          NULL::timestamptz      AS response_created,
          NULL::integer          AS status_code,
          NULL::text             AS error_msg,
          NULL::text             AS response_body_preview,
          LEFT(n.title, 80)      AS notification_title,
          LEFT(n.message, 120)   AS notification_message
      FROM public.push_delivery_log dl
      LEFT JOIN public.notifications n ON n.id = dl.notification_id;';
END $$;

NOTIFY pgrst, 'reload schema';
