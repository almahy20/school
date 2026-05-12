-- ==========================================
-- Migration: 20260402243000_super_admin_rls_full_access
-- Goal: Grant Super Admins full CRUD access to management tables
-- ==========================================

-- 1. Schools: Full access for Super Admins
DROP POLICY IF EXISTS "schools_super_admin_all" ON public.schools;
CREATE POLICY "schools_super_admin_all" ON public.schools 
    FOR ALL TO authenticated 
    USING (public.is_super_admin()) 
    WITH CHECK (public.is_super_admin());

-- 2. Profiles: Ensure Super Admin can manage all profiles
DROP POLICY IF EXISTS "profiles_super_admin_all" ON public.profiles;
CREATE POLICY "profiles_super_admin_all" ON public.profiles 
    FOR ALL TO authenticated 
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- 3. User Roles: Ensure Super Admin can manage all roles
DROP POLICY IF EXISTS "user_roles_super_admin_all" ON public.user_roles;
CREATE POLICY "user_roles_super_admin_all" ON public.user_roles 
    FOR ALL TO authenticated 
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- 4. School Orders: Full access for Super Admins
DROP POLICY IF EXISTS "school_orders_super_admin_all" ON public.school_orders;
CREATE POLICY "school_orders_super_admin_all" ON public.school_orders 
    FOR ALL TO authenticated 
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- 5. RELOAD
NOTIFY pgrst, 'reload schema';
