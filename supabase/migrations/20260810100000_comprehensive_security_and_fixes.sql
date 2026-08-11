-- ==========================================================================
-- Migration: 20260810100000_comprehensive_security_and_fixes.sql
-- Purpose  : Comprehensive fix for all issues found in audit:
--
--   🔴 CRITICAL
--   1. user_roles anon INSERT policy allows unauthenticated users to inject
--      any role (including is_super_admin=true) — SECURITY VULNERABILITY
--   2. Missing GRANT EXECUTE on RPC functions
--   3. Missing table-level GRANTs
--   4. Realtime REPLICA IDENTITY not set → "invalid column for filter" errors
--
--   🟠 HIGH
--   5. Supabase URL still hardcoded in push trigger — replaced with vault lookup
--      (fallback to hardcoded only if vault empty, logged as WARNING)
--
-- ==========================================================================


-- ══════════════════════════════════════════════════════════════════════
-- 1. SECURITY FIX: Tighten anon INSERT policy on user_roles
--    OLD: anon can INSERT anything including is_super_admin=true
--    NEW: anon can only INSERT rows where is_super_admin IS FALSE,
--         role IN ('parent','teacher'), and the school_id exists
-- ══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "user_roles_signup_insert" ON public.user_roles;

CREATE POLICY "user_roles_signup_insert"
ON public.user_roles
FOR INSERT
TO anon
WITH CHECK (
  -- Only allowed roles for public signup
  role IN ('parent', 'teacher')
  -- Must not grant super admin via signup
  AND (is_super_admin IS NULL OR is_super_admin = false)
  -- Must target a real, active school
  AND EXISTS (
    SELECT 1 FROM public.schools
    WHERE id = school_id
      AND status != 'suspended'
  )
);


-- ══════════════════════════════════════════════════════════════════════
-- 2. GRANT EXECUTE on all RPC functions
-- ══════════════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(UUID, BOOLEAN)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_activities(UUID)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_parent_dashboard_summary(UUID, UUID)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_child_full_details(UUID, UUID)            TO authenticated;

-- RPC helpers used by RLS policies
GRANT USAGE  ON SCHEMA internal TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA internal TO authenticated, service_role;

-- Ensure all public functions are callable by authenticated users
-- (covers any newly created RPCs that didn't get explicit grants)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
  LOOP
    BEGIN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',
        r.proname, r.args
      );
    EXCEPTION WHEN OTHERS THEN
      NULL; -- skip if function signature doesn't match
    END;
  END LOOP;
END $$;


-- ══════════════════════════════════════════════════════════════════════
-- 3. TABLE-LEVEL GRANTs
--    (separate from RLS — controls whether role can touch table at all)
-- ══════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fees              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grades            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.complaints        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_templates    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles          TO authenticated;

GRANT ALL ON public.classes           TO service_role;
GRANT ALL ON public.students          TO service_role;
GRANT ALL ON public.fees              TO service_role;
GRANT ALL ON public.attendance        TO service_role;
GRANT ALL ON public.messages          TO service_role;
GRANT ALL ON public.notifications     TO service_role;
GRANT ALL ON public.grades            TO service_role;
GRANT ALL ON public.complaints        TO service_role;
GRANT ALL ON public.exam_templates    TO service_role;
GRANT ALL ON public.profiles          TO service_role;


-- ══════════════════════════════════════════════════════════════════════
-- 4. REPLICA IDENTITY FULL for Realtime filters
--    Fixes "invalid column for filter user_id / receiver_id" errors
--    because Supabase Realtime can only filter on columns in the
--    replica identity (default = primary key only).
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE public.messages      REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Ensure receiver_id column exists (for messages Realtime filter)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_receiver_id   ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id  ON public.notifications(user_id);


-- ══════════════════════════════════════════════════════════════════════
-- 5. PUSH TRIGGER: Replace hardcoded URL with vault lookup
--    The URL is now fetched from vault.decrypted_secrets at runtime.
--    If not in vault, falls back to the hardcoded value with a WARNING.
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trigger_push_on_notification_insert()
RETURNS trigger AS $$
DECLARE
    v_supabase_url     TEXT;
    v_service_role_key TEXT;
    v_target_url       TEXT;
    v_request_id       BIGINT;
BEGIN
    -- ── Fetch Supabase URL from vault (with hardcoded fallback) ────────
    BEGIN
        SELECT decrypted_secret INTO v_supabase_url
          FROM vault.decrypted_secrets
         WHERE name = 'SUPABASE_URL'
         LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        v_supabase_url := NULL;
    END;

    -- Fallback to hardcoded URL if not in vault
    IF v_supabase_url IS NULL OR length(v_supabase_url) < 10 THEN
        v_supabase_url := 'https://mecutwhreywjwstirpka.supabase.co';
        RAISE WARNING '[Push Trigger] SUPABASE_URL not in vault — using hardcoded fallback';
    END IF;

    -- ── Fetch service_role key from vault ──────────────────────────────
    BEGIN
        SELECT decrypted_secret INTO v_service_role_key
          FROM vault.decrypted_secrets
         WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
         LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        v_service_role_key := NULL;
    END;

    -- ── Guard: key not in vault ────────────────────────────────────────
    IF v_service_role_key IS NULL OR length(v_service_role_key) < 20 THEN
        RAISE WARNING '[Push Trigger] CRITICAL: Service role key missing in vault — SKIPPING push for notification id=%', NEW.id;

        BEGIN
            INSERT INTO public.push_trigger_errors
                (notification_id, user_id, error_code, error_message)
            VALUES
                (NEW.id, NEW.user_id, 'VAULT_KEY_MISSING',
                 'SUPABASE_SERVICE_ROLE_KEY is not in vault.decrypted_secrets');
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '[Push Trigger] Also failed to log to push_trigger_errors: %', SQLERRM;
        END;

        RETURN NEW;
    END IF;

    -- ── Determine target URL ───────────────────────────────────────────
    v_target_url := COALESCE(
        NEW.metadata->>'url',
        CASE
            WHEN NEW.type IN ('teacher_message', 'broadcast_message') THEN '/messages'
            ELSE '/notifications'
        END
    );

    -- ── Call Edge Function via pg_net ──────────────────────────────────
    BEGIN
        SELECT net.http_post(
            url     := v_supabase_url || '/functions/v1/send-push-notification',
            headers := jsonb_build_object(
                'Content-Type',  'application/json',
                'Authorization', 'Bearer ' || v_service_role_key,
                'apikey',         v_service_role_key
            ),
            body    := jsonb_build_object(
                'user_id',         NEW.user_id,
                'title',           NEW.title,
                'body',            NEW.message,
                'url',             v_target_url,
                'type',            NEW.type,
                'notification_id', NEW.id
            )
        ) INTO STRICT v_request_id;

        BEGIN
            INSERT INTO public.push_delivery_log
                (notification_id, user_id, pg_net_request_id, target_user_id)
            VALUES (NEW.id, NEW.user_id, v_request_id, NEW.user_id);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '[Push Trigger] Failed to INSERT push_delivery_log: %', SQLERRM;
        END;

    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[Push Trigger] net.http_post EXCEPTION for notification %: %', NEW.id, SQLERRM;

        BEGIN
            INSERT INTO public.push_trigger_errors
                (notification_id, user_id, error_code, error_message)
            VALUES
                (NEW.id, NEW.user_id, 'HTTP_POST_EXCEPTION',
                 'net.http_post raised: ' || left(SQLERRM, 500));
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger
DROP TRIGGER IF EXISTS tr_push_on_notification           ON public.notifications;
DROP TRIGGER IF EXISTS tr_auto_push_on_notification      ON public.notifications;
DROP TRIGGER IF EXISTS tr_push_notification_on_insert    ON public.notifications;
DROP TRIGGER IF EXISTS tr_notification_insert            ON public.notifications;

CREATE TRIGGER tr_auto_push_on_notification
    AFTER INSERT ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_push_on_notification_insert();


-- ══════════════════════════════════════════════════════════════════════
-- 6. Add SUPABASE_URL hint to vault (if vault is available)
--    Admin should run this manually in SQL Editor after deployment:
--    SELECT vault.create_secret('https://mecutwhreywjwstirpka.supabase.co', 'SUPABASE_URL');
-- ══════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════
-- 7. Reload PostgREST schema cache
-- ══════════════════════════════════════════════════════════════════════
NOTIFY pgrst, 'reload schema';
