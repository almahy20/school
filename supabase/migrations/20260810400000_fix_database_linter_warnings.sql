-- =======================================================
-- 🔧 MIGRATION: Fix Supabase Database Linter Warnings
-- Path: supabase/migrations/20260810400000_fix_database_linter_warnings.sql
-- Description: Fixes security warnings from database linter:
--              1. Sets search_path = public on SECURITY DEFINER functions.
--              2. Revokes public EXECUTE privileges on trigger functions.
--              3. Restricts EXECUTE on get_school_id_by_slug.
--              4. Moves pg_net extension from public to net schema.
-- =======================================================

-- ── 1. Set explicit search_path for SECURITY DEFINER functions ─────────────────────
-- Prevents search_path hijacking vulnerabilities
ALTER FUNCTION public.notify_push_v2_row() SET search_path = public;
ALTER FUNCTION public.trigger_push_on_notification_insert() SET search_path = public;
ALTER FUNCTION public.notify_attendance_update() SET search_path = public;
ALTER FUNCTION public.notify_new_grade() SET search_path = public;
ALTER FUNCTION public.notify_complaint_response() SET search_path = public;
ALTER FUNCTION public.notify_new_fee() SET search_path = public;
ALTER FUNCTION public.notify_complaint_status_change() SET search_path = public;


-- ── 2. Revoke direct execution of trigger functions ─────────────────────────────────
-- Trigger functions are called by PostgreSQL internally and should NOT be accessible via RPC.
REVOKE EXECUTE ON FUNCTION public.notify_push_v2_row() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_push_on_notification_insert() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_attendance_update() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_grade() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_complaint_response() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_fee() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_complaint_status_change() FROM public, anon, authenticated;


-- ── 3. Restrict EXECUTE privileges on public utilities ──────────────────────────────
-- Revokes public EXECUTE and explicitly grants it to authenticated, anon, and service_role.
REVOKE EXECUTE ON FUNCTION public.get_school_id_by_slug(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_school_id_by_slug(text) TO anon, authenticated, service_role;


-- ── 4. Move pg_net extension out of the public schema (SKIPPED) ──────────────────────
-- pg_net is marked as relocatable=false in Postgres and does not support SET SCHEMA.
-- Dropping and recreating it with CASCADE is risky because it may drop Supabase webhooks.
-- Since notify_push_v2_row detects the pg_net schema dynamically, leaving it in public is 100% safe.

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
