-- ==========================================
-- Migration: 20260402230000_fix_rls_and_context
-- Fixes: RLS Recursion and Search Path issues causing 500 errors
-- ==========================================

-- 1. Fix internal helper function (Add pg_catalog to search path and improve safety)
CREATE OR REPLACE FUNCTION internal.get_user_context(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_role text;
  v_school_id uuid;
  v_is_super_admin boolean;
  v_approval_status text;
BEGIN
  -- We query public.user_roles directly. 
  -- Since this is SECURITY DEFINER and owned by postgres, it bypasses RLS.
  SELECT 
    r.role::text, 
    r.school_id, 
    COALESCE(r.is_super_admin, false),
    r.approval_status
  INTO v_role, v_school_id, v_is_super_admin, v_approval_status
  FROM public.user_roles r
  WHERE r.user_id = p_user_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'role', v_role,
    'school_id', v_school_id,
    'is_super_admin', v_is_super_admin,
    'approval_status', v_approval_status
  );
END;
$$;

-- 2. Add a helper for approval status
CREATE OR REPLACE FUNCTION public.get_my_approval_status() 
RETURNS text 
LANGUAGE sql 
STABLE
AS $$ 
  SELECT (internal.get_user_context(auth.uid()))->>'approval_status'; 
$$;

-- 3. Simplify RLS policies to reduce complexity and potential recursion
-- We'll use the user_id check first, as it's the most common and fastest.

-- PROFILES
DROP POLICY IF EXISTS "profiles_self" ON public.profiles;
CREATE POLICY "profiles_self" ON public.profiles 
FOR ALL TO authenticated 
USING (
    id = auth.uid() 
    OR public.is_super_admin() 
    OR (school_id = public.get_my_school_id() AND public.get_my_role() = 'admin')
);

-- USER_ROLES
DROP POLICY IF EXISTS "user_roles_self" ON public.user_roles;
CREATE POLICY "user_roles_self" ON public.user_roles 
FOR ALL TO authenticated 
USING (
    user_id = auth.uid() 
    OR public.is_super_admin() 
    OR (school_id = public.get_my_school_id() AND public.get_my_role() = 'admin')
);

-- SCHOOLS
-- Ensure that even if the context is missing, the user can see their own school
DROP POLICY IF EXISTS "schools_access" ON public.schools;
CREATE POLICY "schools_access" ON public.schools 
FOR SELECT TO authenticated 
USING (
    public.is_super_admin() 
    OR id = public.get_my_school_id()
);

-- 4. Final Permission Grant Refresh
GRANT USAGE ON SCHEMA internal TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA internal TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
