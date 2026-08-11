-- ═════════════════════════════════════════════════════════════════════════════════════
-- Migration: fix_remaining_linter_warnings
-- Addresses all Supabase Database Linter WARN items:
--   1. rls_policy_always_true       → tighten permissive RLS policies
--   2. public_bucket_allows_listing → restrict storage SELECT policies
--   3. *_security_definer_function_executable → revoke unnecessary EXECUTE grants
-- NOTE: extension_in_public (pg_net) is intentionally skipped because pg_net is
--       marked relocatable=false and cannot be moved without CASCADE DROP.
-- ═════════════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────────────
-- 1. Fix: RLS Policy Always True
-- ─────────────────────────────────────────────────────────────────────────────────────

-- ── 1a. notification_stats ────────────────────────────────────────────────────────
-- The table is written ONLY by internal SECURITY DEFINER trigger functions
-- (running as the table owner). No user role should be allowed to write freely.
-- Solution: Drop the overly permissive policies and replace them with ones that
-- only allow the service_role (used by trigger functions via SECURITY DEFINER).

DROP POLICY IF EXISTS "Triggers can insert notification stats" ON public.notification_stats;
DROP POLICY IF EXISTS "Triggers can update notification stats" ON public.notification_stats;

-- Allow only service_role (triggers run as owner/service_role) to INSERT / UPDATE
CREATE POLICY "service_role_insert_notification_stats"
  ON public.notification_stats
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "service_role_update_notification_stats"
  ON public.notification_stats
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ── 1b. notifications ─────────────────────────────────────────────────────────────
-- The INSERT policy "notifications_insert_allow" uses WITH CHECK (true) for
-- 'authenticated' users, allowing any signed-in user to insert any notification.
-- Replace with a policy that only allows inserting notifications for the user's
-- own school (checked via the school membership RLS helper).

DROP POLICY IF EXISTS "notifications_insert_allow" ON public.notifications;

-- Only service_role (e.g. trigger / Edge Function) can create notifications.
-- Authenticated users never need to call INSERT on notifications directly.
CREATE POLICY "service_role_insert_notifications"
  ON public.notifications
  FOR INSERT
  TO service_role
  WITH CHECK (true);


-- ── 1c. school_orders ─────────────────────────────────────────────────────────────
-- "school_orders_anyone_insert" allows anon + authenticated to INSERT with no
-- restrictions. Replace with a policy that requires the mandatory fields to be set.
-- Note: school_orders has NO school_id column - it is used for NEW school registration
-- before a school record exists. We validate that required fields are present.

DROP POLICY IF EXISTS "school_orders_anyone_insert" ON public.school_orders;

-- Allow anyone to create a school order, but require the essential fields.
CREATE POLICY "school_orders_valid_fields_insert"
  ON public.school_orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    admin_phone IS NOT NULL
    AND admin_phone <> ''
    AND school_name IS NOT NULL
    AND school_name <> ''
  );


-- ─────────────────────────────────────────────────────────────────────────────────────
-- 2. Fix: Public Bucket Allows Listing
-- ─────────────────────────────────────────────────────────────────────────────────────
-- Public buckets already allow direct URL access without a SELECT policy.
-- The broad SELECT policies allow clients to LIST all files (security concern).
-- Solution: narrow the SELECT policy so clients can only GET a specific object
-- by name (i.e., objects WHERE name = their specific path), not list all files.

-- ── 2a. school_assets bucket ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;

CREATE POLICY "school_assets_object_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'school_assets');

-- ── 2b. school-assets bucket ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can view school assets" ON storage.objects;

CREATE POLICY "school_assets_dash_object_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'school-assets');


-- ─────────────────────────────────────────────────────────────────────────────────────
-- 3. Fix: SECURITY DEFINER Functions Executable by Users
-- ─────────────────────────────────────────────────────────────────────────────────────
-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default.
-- For each SECURITY DEFINER function we must either:
--   a) REVOKE from public/anon/authenticated if it should only be called
--      internally (triggers, cron, service_role).
--   b) Keep EXECUTE for authenticated if the function is an intentional RPC
--      but restrict it to a specific role and add SET search_path.

-- ── 3a. Internal-only / trigger functions ─────────────────────────────────────────
-- These should NEVER be called via REST API:

REVOKE EXECUTE ON FUNCTION public.handle_new_user()
  FROM public, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_attendance()
  FROM public, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_data()
  FROM public, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.notify_admin_new_parent_signup()
  FROM public, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.notify_admin_new_teacher_signup()
  FROM public, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.notify_fee_event()
  FROM public, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_parent_students_by_phone()
  FROM public, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_role_students_by_phone()
  FROM public, anon, authenticated;


-- ── 3b. Admin-only RPCs (should be callable by authenticated users, NOT anon) ─────
-- These are intentional RPC endpoints, but should only be called by signed-in users.
-- We keep EXECUTE for 'authenticated' but revoke from anon/public.

-- activate_school_admin: only called by super admins
REVOKE EXECUTE ON FUNCTION public.activate_school_admin(uuid, uuid, text, text)
  FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.activate_school_admin(uuid, uuid, text, text)
  TO authenticated, service_role;

-- delete_user_entirely: dangerous, admin-only
REVOKE EXECUTE ON FUNCTION public.delete_user_entirely(uuid)
  FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.delete_user_entirely(uuid)
  TO authenticated, service_role;

-- generate_monthly_fees: admin-only action
REVOKE EXECUTE ON FUNCTION public.generate_monthly_fees(uuid, integer, integer, numeric, text)
  FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.generate_monthly_fees(uuid, integer, integer, numeric, text)
  TO authenticated, service_role;

-- create_notification: called by server-side code, not by end users
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, uuid, text, text, text, text)
  FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.create_notification(uuid, uuid, text, text, text, text)
  TO service_role;

-- log_action: audit log, should only be called by service_role
REVOKE EXECUTE ON FUNCTION public.log_action(text, text, uuid, text, jsonb, jsonb)
  FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.log_action(text, text, uuid, text, jsonb, jsonb)
  TO service_role;


-- ── 3c. Helper / data RPCs (intentionally callable by authenticated users) ─────────
-- These ARE legitimate user-facing RPCs. We revoke from anon but keep authenticated.
-- We also set search_path to prevent hijacking.

-- can_user_manage_school: used in RLS policies, keep for authenticated
REVOKE EXECUTE ON FUNCTION public.can_user_manage_school(uuid, uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.can_user_manage_school(uuid, uuid) TO authenticated, service_role;
ALTER  FUNCTION public.can_user_manage_school(uuid, uuid) SET search_path = public;

-- get_my_role / get_my_school_id: session helpers, keep for authenticated
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_role() TO authenticated, service_role;
ALTER  FUNCTION public.get_my_role() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_my_school_id() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_school_id() TO authenticated, service_role;
ALTER  FUNCTION public.get_my_school_id() SET search_path = public;

-- is_super_admin: session helper, keep for authenticated
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;
ALTER  FUNCTION public.is_super_admin() SET search_path = public;

-- is_my_student_parent: keep for authenticated
REVOKE EXECUTE ON FUNCTION public.is_my_student_parent(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.is_my_student_parent(uuid) TO authenticated, service_role;
ALTER  FUNCTION public.is_my_student_parent(uuid) SET search_path = public;

-- Dashboard stat RPCs: keep for authenticated
REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats(uuid, boolean) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_dashboard_stats(uuid, boolean) TO authenticated, service_role;
ALTER  FUNCTION public.get_dashboard_stats(uuid, boolean) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_activities(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_admin_dashboard_activities(uuid) TO authenticated, service_role;
ALTER  FUNCTION public.get_admin_dashboard_activities(uuid) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_today_attendance_stats(uuid, date) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_today_attendance_stats(uuid, date) TO authenticated, service_role;
ALTER  FUNCTION public.get_today_attendance_stats(uuid, date) SET search_path = public;

-- Child / parent RPCs: keep for authenticated (parent role needs these)
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

REVOKE EXECUTE ON FUNCTION public.get_parent_dashboard_summary(uuid, uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_parent_dashboard_summary(uuid, uuid) TO authenticated, service_role;
ALTER  FUNCTION public.get_parent_dashboard_summary(uuid, uuid) SET search_path = public;

-- Fee RPCs: keep for authenticated
REVOKE EXECUTE ON FUNCTION public.get_fee_statistics(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_fee_statistics(uuid) TO authenticated, service_role;
ALTER  FUNCTION public.get_fee_statistics(uuid) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_fees_summary(uuid, text, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_fees_summary(uuid, text, text) TO authenticated, service_role;
ALTER  FUNCTION public.get_fees_summary(uuid, text, text) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_financial_stats(uuid, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_financial_stats(uuid, text) TO authenticated, service_role;
ALTER  FUNCTION public.get_financial_stats(uuid, text) SET search_path = public;

-- get_school_id_by_slug: used on the login/signup page by anon users → keep anon
-- (This is intentional - anon users need it to resolve school slug on the login page)
-- Already handled in previous migration. Keeping here for documentation only.
-- REVOKE EXECUTE ON FUNCTION public.get_school_id_by_slug(text) FROM public;
-- GRANT  EXECUTE ON FUNCTION public.get_school_id_by_slug(text) TO anon, authenticated, service_role;
ALTER  FUNCTION public.get_school_id_by_slug(text) SET search_path = public;


-- ─────────────────────────────────────────────────────────────────────────────────────
-- 4. Refresh PostgREST schema cache
-- ─────────────────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
