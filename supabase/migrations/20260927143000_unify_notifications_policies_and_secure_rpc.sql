-- Migration: Unify notifications permissive RLS policies and secure RPC functions
-- Timestamp: 2026-09-27 14:30:00

-- ============================================================================
-- 1. Unify RLS Policies on Notification & Auxiliary Tables
-- (Separating SELECT from INSERT/UPDATE/DELETE to prevent ALL/SELECT overlap)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1 Table: push_trigger_errors
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "push_trigger_errors_super_admin_full" ON public.push_trigger_errors;
DROP POLICY IF EXISTS "push_trigger_errors_admin_school" ON public.push_trigger_errors;
DROP POLICY IF EXISTS "push_trigger_errors_super_admin" ON public.push_trigger_errors;
DROP POLICY IF EXISTS "push_trigger_errors_super_admin_modify" ON public.push_trigger_errors;
DROP POLICY IF EXISTS "push_trigger_errors_select_unified" ON public.push_trigger_errors;
DROP POLICY IF EXISTS "push_trigger_errors_insert_unified" ON public.push_trigger_errors;
DROP POLICY IF EXISTS "push_trigger_errors_update_unified" ON public.push_trigger_errors;
DROP POLICY IF EXISTS "push_trigger_errors_delete_unified" ON public.push_trigger_errors;

CREATE POLICY "push_trigger_errors_select_unified" ON public.push_trigger_errors
FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR (
    has_role((SELECT auth.uid()), 'admin')
    AND EXISTS (
      SELECT 1 FROM notifications n
      JOIN user_roles ur ON ur.user_id = (SELECT auth.uid())
      WHERE n.id = push_trigger_errors.notification_id AND n.school_id = ur.school_id
    )
  )
);

CREATE POLICY "push_trigger_errors_insert_unified" ON public.push_trigger_errors
FOR INSERT TO authenticated
WITH CHECK (is_super_admin());

CREATE POLICY "push_trigger_errors_update_unified" ON public.push_trigger_errors
FOR UPDATE TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());

CREATE POLICY "push_trigger_errors_delete_unified" ON public.push_trigger_errors
FOR DELETE TO authenticated
USING (is_super_admin());


-- ----------------------------------------------------------------------------
-- 1.2 Table: notification_delivery_logs
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "notification_delivery_logs_super_admin_full" ON public.notification_delivery_logs;
DROP POLICY IF EXISTS "ndl_read" ON public.notification_delivery_logs;
DROP POLICY IF EXISTS "notification_delivery_logs_admin_school" ON public.notification_delivery_logs;
DROP POLICY IF EXISTS "notification_delivery_logs_super_admin_modify" ON public.notification_delivery_logs;
DROP POLICY IF EXISTS "notification_delivery_logs_select_unified" ON public.notification_delivery_logs;
DROP POLICY IF EXISTS "notification_delivery_logs_insert_unified" ON public.notification_delivery_logs;
DROP POLICY IF EXISTS "notification_delivery_logs_update_unified" ON public.notification_delivery_logs;
DROP POLICY IF EXISTS "notification_delivery_logs_delete_unified" ON public.notification_delivery_logs;

CREATE POLICY "notification_delivery_logs_select_unified" ON public.notification_delivery_logs
FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR (
    has_role((SELECT auth.uid()), 'admin')
    AND EXISTS (
      SELECT 1 FROM notifications n
      JOIN user_roles ur ON ur.user_id = (SELECT auth.uid())
      WHERE n.id = notification_delivery_logs.notification_id AND n.school_id = ur.school_id
    )
  )
);

CREATE POLICY "notification_delivery_logs_insert_unified" ON public.notification_delivery_logs
FOR INSERT TO authenticated
WITH CHECK (is_super_admin());

CREATE POLICY "notification_delivery_logs_update_unified" ON public.notification_delivery_logs
FOR UPDATE TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());

CREATE POLICY "notification_delivery_logs_delete_unified" ON public.notification_delivery_logs
FOR DELETE TO authenticated
USING (is_super_admin());


-- ----------------------------------------------------------------------------
-- 1.3 Table: push_delivery_log
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "push_delivery_log_super_admin_full" ON public.push_delivery_log;
DROP POLICY IF EXISTS "push_delivery_log_admin_school" ON public.push_delivery_log;
DROP POLICY IF EXISTS "push_delivery_log_super_admin_modify" ON public.push_delivery_log;
DROP POLICY IF EXISTS "push_delivery_log_select_unified" ON public.push_delivery_log;
DROP POLICY IF EXISTS "push_delivery_log_insert_unified" ON public.push_delivery_log;
DROP POLICY IF EXISTS "push_delivery_log_update_unified" ON public.push_delivery_log;
DROP POLICY IF EXISTS "push_delivery_log_delete_unified" ON public.push_delivery_log;

CREATE POLICY "push_delivery_log_select_unified" ON public.push_delivery_log
FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR (
    has_role((SELECT auth.uid()), 'admin')
    AND EXISTS (
      SELECT 1 FROM notifications n
      JOIN user_roles ur ON ur.user_id = (SELECT auth.uid())
      WHERE n.id = push_delivery_log.notification_id AND n.school_id = ur.school_id
    )
  )
);

CREATE POLICY "push_delivery_log_insert_unified" ON public.push_delivery_log
FOR INSERT TO authenticated
WITH CHECK (is_super_admin());

CREATE POLICY "push_delivery_log_update_unified" ON public.push_delivery_log
FOR UPDATE TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());

CREATE POLICY "push_delivery_log_delete_unified" ON public.push_delivery_log
FOR DELETE TO authenticated
USING (is_super_admin());


-- ----------------------------------------------------------------------------
-- 1.4 Table: push_subscriptions
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "push_subscriptions_own" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_super_admin_full" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_admin_school" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_modify_unified" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_select_unified" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_insert_unified" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_update_unified" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_delete_unified" ON public.push_subscriptions;

CREATE POLICY "push_subscriptions_select_unified" ON public.push_subscriptions
FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR is_super_admin()
  OR (
    has_role((SELECT auth.uid()), 'admin')
    AND school_id IN (
      SELECT ur.school_id 
      FROM user_roles ur 
      WHERE ur.user_id = (SELECT auth.uid())
    )
  )
);

CREATE POLICY "push_subscriptions_insert_unified" ON public.push_subscriptions
FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid()) OR is_super_admin()
);

CREATE POLICY "push_subscriptions_update_unified" ON public.push_subscriptions
FOR UPDATE TO authenticated
USING (
  user_id = (SELECT auth.uid()) OR is_super_admin()
)
WITH CHECK (
  user_id = (SELECT auth.uid()) OR is_super_admin()
);

CREATE POLICY "push_subscriptions_delete_unified" ON public.push_subscriptions
FOR DELETE TO authenticated
USING (
  user_id = (SELECT auth.uid()) OR is_super_admin()
);


-- ============================================================================
-- 2. Revoke Anon Execute on Sensitive / Internal SECURITY DEFINER Functions
-- ============================================================================

-- Admin operations
REVOKE EXECUTE ON FUNCTION public.claim_school_admin(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_school_admin(uuid) TO authenticated;

-- User profile & data
REVOKE EXECUTE ON FUNCTION public.get_complete_user_data(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_complete_user_data(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_school_id() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_school_id() TO authenticated;

-- Statistics & Summaries
REVOKE EXECUTE ON FUNCTION public.get_fees_summary(uuid, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_fees_summary(uuid, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_class_curriculum_status(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_class_curriculum_status(uuid) TO authenticated;

-- Student/Teacher Lookups
REVOKE EXECUTE ON FUNCTION public.get_parent_student_ids(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_parent_student_ids(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_teacher_class_ids(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_teacher_class_ids(uuid) TO authenticated;

-- Notifications
REVOKE EXECUTE ON FUNCTION public.get_unread_notification_counts(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_counts(uuid) TO authenticated;

-- Audit Logging & Exams
REVOKE EXECUTE ON FUNCTION public.log_action(text, text, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.log_action(text, text, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.recalculate_exam_scores(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.recalculate_exam_scores(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_exam_attempt(uuid, uuid, uuid, jsonb, integer, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.submit_exam_attempt(uuid, uuid, uuid, jsonb, integer, integer) TO authenticated;

-- Phone sync helpers
REVOKE EXECUTE ON FUNCTION public.sync_parent_students_by_phone() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.sync_parent_students_by_phone() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_role_students_by_phone() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.sync_role_students_by_phone() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_student_parent_by_phone() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.sync_student_parent_by_phone() TO authenticated;
