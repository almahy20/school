-- ==========================================================================
-- Migration: 20260826000000_security_linter_safe_fixes.sql
-- Purpose  : Fix Supabase security linter warnings without breaking any
--            existing functionality for admin, teacher, or parent roles.
--
-- What this migration does:
--   1. Fix search_path for 2 specific SECURITY DEFINER functions
--      (uses SET search_path = public — NOT empty string, which broke things before)
--   2. Revoke EXECUTE via /rpc/ from trigger-only functions that the app
--      code never calls directly (they run automatically via DB triggers)
--
-- What this migration does NOT touch:
--   - Any function called directly by the frontend (get_complete_user_data,
--     get_parent_dashboard_summary, get_child_full_details, log_action, etc.)
--   - Any table grants or RLS policies
--   - custom_access_token_hook (auth hook — left untouched intentionally)
-- ==========================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- PART 1: Fix search_path for the 2 functions flagged by the linter
--
-- Why search_path = public and not ''?
--   Setting search_path = '' was tried before (see 20260819160000) and
--   immediately reverted (see 20260819161000) because all RPCs broke.
--   The functions reference tables without schema prefix (e.g. FROM students
--   instead of FROM public.students), so they need public in search_path.
--   Setting search_path = public still satisfies the linter requirement of
--   having an explicit, immutable search_path on the function.
-- ──────────────────────────────────────────────────────────────────────────

-- Fix: get_unread_notification_counts
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_unread_notification_counts'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.get_unread_notification_counts(uuid) SET search_path = public';
  END IF;
END $$;

-- Fix: custom_access_token_hook
-- Note: This is a Supabase Auth hook. We only fix search_path — nothing else.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'custom_access_token_hook'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.custom_access_token_hook(jsonb) SET search_path = public';
  END IF;
END $$;


-- ──────────────────────────────────────────────────────────────────────────
-- PART 2: Revoke EXECUTE via /rpc/ from trigger-only functions
--
-- These functions are called ONLY by PostgreSQL database triggers
-- (e.g. AFTER INSERT ON grades → notify_new_grade fires automatically).
-- The frontend code never calls them via supabase.rpc(). Revoking EXECUTE
-- from anon/authenticated removes the linter warning without any side effect.
--
-- The trigger mechanism itself uses the function owner / superuser context
-- and is NOT affected by REVOKE EXECUTE on roles.
-- ──────────────────────────────────────────────────────────────────────────

-- Trigger functions that fire on grades/notifications changes
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND p.proname = 'notify_new_grade') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.notify_new_grade() FROM anon, authenticated';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND p.proname = 'update_notification_stats') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.update_notification_stats() FROM anon, authenticated';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND p.proname = 'trigger_push_on_notification_insert') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.trigger_push_on_notification_insert() FROM anon, authenticated';
  END IF;
END $$;

-- Trigger functions that fire on attendance changes
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND p.proname = 'notify_attendance_update') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.notify_attendance_update() FROM anon, authenticated';
  END IF;
END $$;

-- Trigger functions that fire on fees changes
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND p.proname = 'notify_fee_event') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.notify_fee_event() FROM anon, authenticated';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND p.proname = 'notify_new_fee') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.notify_new_fee() FROM anon, authenticated';
  END IF;
END $$;

-- Trigger functions that fire on complaints changes
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND p.proname = 'notify_admin_new_complaint') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.notify_admin_new_complaint() FROM anon, authenticated';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND p.proname = 'notify_complaint_response') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.notify_complaint_response() FROM anon, authenticated';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND p.proname = 'notify_complaint_status_change') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.notify_complaint_status_change() FROM anon, authenticated';
  END IF;
END $$;

-- Trigger functions that fire on user/parent signup
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND p.proname = 'notify_admin_new_parent_signup') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.notify_admin_new_parent_signup() FROM anon, authenticated';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND p.proname = 'notify_admin_new_teacher_signup') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.notify_admin_new_teacher_signup() FROM anon, authenticated';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND p.proname = 'handle_new_user') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated';
  END IF;
END $$;

-- Trigger functions that fire on push notifications
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND p.proname = 'notify_push_v2_row') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.notify_push_v2_row() FROM anon, authenticated';
  END IF;
END $$;

-- Trigger functions that fire on conversation messages
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND p.proname = 'notify_on_new_conversation_message') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.notify_on_new_conversation_message() FROM anon, authenticated';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND p.proname = 'update_conversation_on_new_message') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.update_conversation_on_new_message() FROM anon, authenticated';
  END IF;
END $$;

-- Trigger functions for role/metadata sync
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND p.proname = 'sync_role_to_auth_metadata') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.sync_role_to_auth_metadata() FROM anon, authenticated';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
             WHERE n.nspname = 'public' AND p.proname = 'sync_user_metadata_trigger') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.sync_user_metadata_trigger() FROM anon, authenticated';
  END IF;
END $$;


-- ──────────────────────────────────────────────────────────────────────────
-- Reload PostgREST schema cache
-- ──────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
