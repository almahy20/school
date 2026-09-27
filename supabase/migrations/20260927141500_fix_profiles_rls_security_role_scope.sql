-- ============================================================================
-- Migration: 20260927141500_fix_profiles_rls_security_role_scope.sql
-- Description: Restrict profiles SELECT in school to admin/teacher/super_admin only
-- ============================================================================

DROP POLICY IF EXISTS "profiles_select_unified" ON public.profiles;

CREATE POLICY "profiles_select_unified" ON public.profiles
FOR SELECT TO authenticated
USING (
  id = (SELECT auth.uid())
  OR is_super_admin()
  OR (
    (SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = (SELECT auth.uid()) LIMIT 1) IN ('admin', 'teacher', 'super_admin')
    AND school_id = (SELECT ur.school_id FROM public.user_roles ur WHERE ur.user_id = (SELECT auth.uid()) LIMIT 1)
  )
);
