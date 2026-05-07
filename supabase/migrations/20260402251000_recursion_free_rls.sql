-- ==========================================
-- Migration: 20260402251000_recursion_free_rls
-- Goal: Break the infinite loading loop by using Metadata-based RLS
-- ==========================================

-- 1. DROP ALL EXISTING POLICIES TO START FRESH
DO $$ 
DECLARE 
    t text;
    p text;
BEGIN
    FOR t, p IN 
        SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', p, t);
    END LOOP;
END $$;

-- 2. UNIVERSAL ACCESS HELPERS (Recursion-Free using JWT Metadata)
-- These rely on the login token which Supabase populates from auth.users.raw_app_meta_data / raw_user_meta_data
CREATE OR REPLACE FUNCTION public.is_super_admin() 
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE((auth.jwt() -> 'user_metadata' ->> 'is_super_admin')::boolean, false);
$$;

CREATE OR REPLACE FUNCTION public.get_my_school_id() 
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid;
$$;

-- 3. CORE POLICIES
-- A. Schools (Read-only for all authenticated, Full for Super Admin)
CREATE POLICY "schools_read" ON public.schools FOR SELECT TO authenticated USING (true);
CREATE POLICY "schools_super_admin" ON public.schools FOR ALL TO authenticated USING (public.is_super_admin());
CREATE POLICY "schools_anon_read" ON public.schools FOR SELECT TO anon USING (true);

-- B. Profiles & Roles (Admin can manage their school, User can see self)
CREATE POLICY "profiles_self" ON public.profiles FOR ALL TO authenticated USING (id = auth.uid() OR public.is_super_admin());
CREATE POLICY "profiles_admin" ON public.profiles FOR ALL TO authenticated 
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' AND school_id = public.get_my_school_id());

CREATE POLICY "user_roles_self" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_super_admin());
CREATE POLICY "user_roles_admin" ON public.user_roles FOR ALL TO authenticated 
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' AND school_id = public.get_my_school_id());

-- 4. DATA TABLES (Isolation Loop)
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN 
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name NOT IN ('schools', 'profiles', 'user_roles', 'school_orders')
    LOOP
        EXECUTE format('
            CREATE POLICY "isolation_policy" ON public.%I 
            FOR ALL TO authenticated 
            USING (
                public.is_super_admin() 
                OR school_id = public.get_my_school_id()
            );', t);
    END LOOP;
END $$;

-- 5. SCHOOL ORDERS (Super Admin Only)
CREATE POLICY "school_orders_admin" ON public.school_orders FOR ALL TO authenticated USING (public.is_super_admin());

-- Reload
NOTIFY pgrst, 'reload schema';
