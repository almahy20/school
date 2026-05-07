-- ======================================================
-- Fix Super Admin RLS access for user_roles and profiles
-- ======================================================

-- 1. Profiles: Stronger Super Admin access
DROP POLICY IF EXISTS "profiles_self" ON public.profiles;
CREATE POLICY "profiles_enhanced_access" ON public.profiles
FOR ALL TO authenticated
USING (
    id = auth.uid() 
    OR public.is_super_admin() 
    OR (school_id = public.get_my_school_id() AND public.get_my_role() = 'admin')
)
WITH CHECK (
    id = auth.uid() 
    OR public.is_super_admin() 
    OR (school_id = public.get_my_school_id() AND public.get_my_role() = 'admin')
);

-- 2. User Roles: Stronger Super Admin access
DROP POLICY IF EXISTS "user_roles_self" ON public.user_roles;
CREATE POLICY "user_roles_enhanced_access" ON public.user_roles
FOR ALL TO authenticated
USING (
    user_id = auth.uid() 
    OR public.is_super_admin() 
    OR (school_id = public.get_my_school_id() AND public.get_my_role() = 'admin')
)
WITH CHECK (
    user_id = auth.uid() 
    OR public.is_super_admin() 
    OR (school_id = public.get_my_school_id() AND public.get_my_role() = 'admin')
);

-- 3. Additional grants to ensure Super Admin can bypass normal flow
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;

NOTIFY pgrst, 'reload schema';
