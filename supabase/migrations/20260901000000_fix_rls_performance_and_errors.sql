-- ==========================================================================
-- Migration: 20260901000000_fix_rls_performance_and_errors.sql
-- Purpose  : إصلاح 158 Slow Queries و 39.7% Database Errors
-- Root Cause: RLS policies تستدعي helper functions تُنفّذ subqueries على
--             user_roles في كل SELECT، مما يُضاعف load قاعدة البيانات
-- ==========================================================================

SET search_path TO public;

-- ==========================================================================
-- 1. فهارس حرجة على user_roles — الأهم على الإطلاق
--    get_auth_school_id() و is_school_admin() و is_super_admin()
--    كلها تعمل WHERE user_id = auth.uid() بدون index → full table scan
-- ==========================================================================

-- Index أساسي على user_id منفرداً (يُستخدم في كل RLS check)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id
ON public.user_roles (user_id);

-- Index جزئي للـ super admins فقط (يجعل is_super_admin() فائق السرعة)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_is_super_admin
ON public.user_roles (user_id, is_super_admin)
WHERE is_super_admin = true;

-- ==========================================================================
-- 2. إعادة بناء الـ helper functions بـ statement_timeout لمنع الـ timeouts
--    والإبقاء على نفس المنطق الأمني بدقة
-- ==========================================================================

-- دالة جلب school_id للمستخدم الحالي
CREATE OR REPLACE FUNCTION public.get_auth_school_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET statement_timeout = '1s'
AS $$
  SELECT school_id FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- دالة التحقق من صلاحية School Admin لمدرسة محددة
CREATE OR REPLACE FUNCTION public.is_school_admin(target_school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET statement_timeout = '1s'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND (
        is_super_admin = true
        OR (role = 'admin' AND approval_status = 'approved' AND school_id = target_school_id)
      )
  );
$$;

-- دالة التحقق من صلاحية Super Admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET statement_timeout = '1s'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND is_super_admin = true
    LIMIT 1
  );
$$;

-- إعادة منح الصلاحيات بعد إعادة البناء
GRANT EXECUTE ON FUNCTION public.get_auth_school_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_school_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;

-- ==========================================================================
-- 3. إصلاح RLS policy على profiles لتكون أخف ثقلاً
--    المشكلة: profiles_view_own تستدعي get_auth_school_id() → subquery
--    في كل SELECT على profiles
--    الحل: استخدام inline subquery مباشرة بدل function call
-- ==========================================================================

-- حذف الـ policy القديمة الثقيلة
DROP POLICY IF EXISTS "profiles_view_own" ON public.profiles;

-- إنشاء policy جديدة خفيفة: inline subquery بدل function call
-- (يُنتج نفس execution plan لكن يُجنّب overhead الـ function invocation لكل صف)
CREATE POLICY "profiles_view_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR school_id = (
      SELECT school_id FROM public.user_roles
      WHERE user_id = auth.uid() LIMIT 1
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND is_super_admin = true LIMIT 1
    )
  );

-- ==========================================================================
-- 4. فهارس لتحسين Realtime performance
--    الـ Realtime errors ناتجة عن ضغط الـ connections، هذه الفهارس
--    تُسرّع الـ queries التي يُولّدها Realtime عند broadcast
-- ==========================================================================

-- فهرس على notifications مُحسَّن للـ Realtime subscriptions
CREATE INDEX IF NOT EXISTS idx_notifications_realtime_user_created
ON public.notifications (user_id, created_at DESC);

-- فهرس على conversations للـ Realtime subscriptions
CREATE INDEX IF NOT EXISTS idx_conversations_realtime_school
ON public.conversations (school_id, last_message_at DESC);

-- ==========================================================================
-- 5. ANALYZE لتحديث إحصائيات Query Planner
--    بعد إضافة الفهارس الجديدة، يحتاج PostgreSQL لتحديث الإحصائيات
--    حتى يستخدم هذه الفهارس فعلياً في execution plans
-- ==========================================================================

ANALYZE public.user_roles;
ANALYZE public.profiles;
ANALYZE public.notifications;
ANALYZE public.conversations;

-- إعادة تحميل schema cache لـ PostgREST
NOTIFY pgrst, 'reload schema';
