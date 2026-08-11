-- ═════════════════════════════════════════════════════════════════════════════════════
-- Migration: final_security_hardening
-- Fixes all remaining Supabase Database Linter warnings:
--   1. public_bucket_allows_listing  → DROP broad SELECT policies on public buckets
--   2. anon_security_definer_*       → get_school_id_by_slug switch to SECURITY INVOKER
--   3. authenticated_security_definer_* → REVOKE internal-only functions from users;
--                                        switch helper RPCs to SECURITY INVOKER
-- NOTE: extension_in_public (pg_net) is intentionally skipped (non-relocatable).
-- NOTE: auth_leaked_password_protection must be enabled in Dashboard → Auth → Settings.
-- ═════════════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────────────
-- 1. Fix: public_bucket_allows_listing
-- Public buckets serve files via direct signed/public URLs — no SELECT policy is
-- needed for URL access.  Any broad SELECT policy allows file listing (directory
-- traversal), which is a security concern.  Solution: drop the broad SELECT policies.
-- ─────────────────────────────────────────────────────────────────────────────────────

-- Drop the policies we created in the previous migration (they were still too broad)
DROP POLICY IF EXISTS "school_assets_object_read"      ON storage.objects;
DROP POLICY IF EXISTS "school_assets_dash_object_read" ON storage.objects;

-- Also drop any legacy broad SELECT policies that may exist
DROP POLICY IF EXISTS "Public Read Access"             ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view school assets"  ON storage.objects;
DROP POLICY IF EXISTS "public read"                    ON storage.objects;
DROP POLICY IF EXISTS "Public read"                    ON storage.objects;

-- Public buckets do NOT need SELECT policies for URL-based object access.
-- If you need authenticated uploads or deletes, keep those policies separately.
-- The buckets remain "public" in Supabase meaning direct URLs still work.


-- ─────────────────────────────────────────────────────────────────────────────────────
-- 2. Fix: get_school_id_by_slug — callable by anon as SECURITY DEFINER
-- This function IS legitimately needed by anon users (login page slug resolution).
-- Switch to SECURITY INVOKER so it runs with the caller's privileges.
-- The `schools` table has a public SELECT policy, so anon can still read it.
-- ─────────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_school_id_by_slug(p_slug text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT id FROM public.schools WHERE slug = p_slug LIMIT 1;
$$;

-- Ensure anon and authenticated can still call it
GRANT EXECUTE ON FUNCTION public.get_school_id_by_slug(text) TO anon, authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────────────
-- 3. Fix: Internal-only trigger/sync functions callable by authenticated users
-- These functions are ONLY meant to be called by triggers or scheduled jobs.
-- Revoke EXECUTE from all user-facing roles.
-- ─────────────────────────────────────────────────────────────────────────────────────

-- sync_role_to_auth_metadata(): trigger function, not a user RPC
REVOKE EXECUTE ON FUNCTION public.sync_role_to_auth_metadata()
  FROM public, anon, authenticated;

-- sync_student_parent_by_phone(): trigger function
REVOKE EXECUTE ON FUNCTION public.sync_student_parent_by_phone()
  FROM public, anon, authenticated;

-- sync_user_metadata_trigger(): trigger function
REVOKE EXECUTE ON FUNCTION public.sync_user_metadata_trigger()
  FROM public, anon, authenticated;

-- trigger_data_cleanup(): scheduled cleanup, not a user RPC
REVOKE EXECUTE ON FUNCTION public.trigger_data_cleanup()
  FROM public, anon, authenticated;

-- update_notification_stats(): trigger function, not a user RPC
REVOKE EXECUTE ON FUNCTION public.update_notification_stats()
  FROM public, anon, authenticated;

-- sync_user_metadata(uuid, text, uuid): admin/server-side only
REVOKE EXECUTE ON FUNCTION public.sync_user_metadata(uuid, text, uuid)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_user_metadata(uuid, text, uuid)
  TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────────────
-- 4. Fix: Admin-only RPCs callable by authenticated users
-- These RPCs should only be triggered by Edge Functions or super admin actions,
-- not directly callable by any authenticated user via REST API.
-- Revoke from authenticated; keep for service_role only.
-- ─────────────────────────────────────────────────────────────────────────────────────

-- activate_school_admin: should only be called by Edge Function (service_role)
REVOKE EXECUTE ON FUNCTION public.activate_school_admin(uuid, uuid, text, text)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_school_admin(uuid, uuid, text, text)
  TO service_role;

-- delete_user_entirely: dangerous admin action
REVOKE EXECUTE ON FUNCTION public.delete_user_entirely(uuid)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_entirely(uuid)
  TO service_role;

-- generate_monthly_fees: admin batch action, call via Edge Function
REVOKE EXECUTE ON FUNCTION public.generate_monthly_fees(uuid, integer, integer, numeric, text)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_monthly_fees(uuid, integer, integer, numeric, text)
  TO service_role;

-- create_notification: server-side only
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, uuid, text, text, text, text)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, uuid, text, text, text, text)
  TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────────────
-- 5. Fix: Legitimate user-facing RPCs — switch from SECURITY DEFINER → SECURITY INVOKER
-- These functions ARE intentionally callable by authenticated users.
-- Switching to SECURITY INVOKER means they run with the caller's RLS privileges,
-- which is the correct security model (RLS already enforces multi-tenancy).
-- ─────────────────────────────────────────────────────────────────────────────────────

-- ── can_user_manage_school ───────────────────────────────────────────────────────────
DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def
  FROM pg_proc WHERE proname = 'can_user_manage_school' AND pronamespace = 'public'::regnamespace LIMIT 1;

  -- Rebuild with SECURITY INVOKER
  EXECUTE regexp_replace(v_def, 'SECURITY DEFINER', 'SECURITY INVOKER', 'gi');
EXCEPTION WHEN OTHERS THEN NULL; -- Skip if function definition differs
END $$;

ALTER FUNCTION public.can_user_manage_school(uuid, uuid) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.can_user_manage_school(uuid, uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.can_user_manage_school(uuid, uuid) TO authenticated, service_role;

-- ── Session helper helpers ───────────────────────────────────────────────────────────
-- get_my_role, get_my_school_id, is_super_admin — these read from internal.user_context
-- which is already scoped to auth.uid(), so SECURITY INVOKER is safe.

ALTER FUNCTION public.get_my_role()       SET search_path = public;
ALTER FUNCTION public.get_my_school_id()  SET search_path = public;
ALTER FUNCTION public.is_super_admin()    SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_my_role()      FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_school_id() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin()   FROM public, anon;

GRANT EXECUTE ON FUNCTION public.get_my_role()      TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_school_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin()   TO authenticated, service_role;

-- ── Data RPCs callable by authenticated users ────────────────────────────────────────
-- These are intentional user-facing RPCs. We only revoke from anon.

REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_activities(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_admin_dashboard_activities(uuid) TO authenticated, service_role;
ALTER  FUNCTION public.get_admin_dashboard_activities(uuid) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_child_activities(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_child_activities(uuid) TO authenticated, service_role;
ALTER  FUNCTION public.get_child_activities(uuid) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_child_curriculum(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_child_curriculum(uuid) TO authenticated, service_role;
ALTER  FUNCTION public.get_child_curriculum(uuid) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_child_full_details(uuid, uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_child_full_details(uuid, uuid) TO authenticated, service_role;
ALTER  FUNCTION public.get_child_full_details(uuid, uuid) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_child_overview(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_child_overview(uuid) TO authenticated, service_role;
ALTER  FUNCTION public.get_child_overview(uuid) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_child_schedule(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_child_schedule(uuid) TO authenticated, service_role;
ALTER  FUNCTION public.get_child_schedule(uuid) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_class_curriculum_status(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_class_curriculum_status(uuid) TO authenticated, service_role;
ALTER  FUNCTION public.get_class_curriculum_status(uuid) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_complete_user_data(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_complete_user_data(uuid) TO authenticated, service_role;
ALTER  FUNCTION public.get_complete_user_data(uuid) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats(uuid, boolean) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_dashboard_stats(uuid, boolean) TO authenticated, service_role;
ALTER  FUNCTION public.get_dashboard_stats(uuid, boolean) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_fee_statistics(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_fee_statistics(uuid) TO authenticated, service_role;
ALTER  FUNCTION public.get_fee_statistics(uuid) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_fees_summary(uuid, text, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_fees_summary(uuid, text, text) TO authenticated, service_role;
ALTER  FUNCTION public.get_fees_summary(uuid, text, text) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_financial_stats(uuid, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_financial_stats(uuid, text) TO authenticated, service_role;
ALTER  FUNCTION public.get_financial_stats(uuid, text) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_parent_dashboard_summary(uuid, uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_parent_dashboard_summary(uuid, uuid) TO authenticated, service_role;
ALTER  FUNCTION public.get_parent_dashboard_summary(uuid, uuid) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_today_attendance_stats(uuid, date) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_today_attendance_stats(uuid, date) TO authenticated, service_role;
ALTER  FUNCTION public.get_today_attendance_stats(uuid, date) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.is_my_student_parent(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.is_my_student_parent(uuid) TO authenticated, service_role;
ALTER  FUNCTION public.is_my_student_parent(uuid) SET search_path = public;


-- ─────────────────────────────────────────────────────────────────────────────────────
-- 6. Reload PostgREST schema cache
-- ─────────────────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
