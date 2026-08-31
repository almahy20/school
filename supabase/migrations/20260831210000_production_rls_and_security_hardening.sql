-- ==============================================================================
-- Migration: 20260831210000_production_rls_and_security_hardening.sql
-- Goal: Production Security Hardening & Zero-Recursion RLS
-- ==============================================================================

-- ── 0. RECURSION-FREE SECURITY DEFINER HELPERS ──────────────────────────────
-- These functions run with postgres privileges to check caller roles without triggering RLS loops
CREATE OR REPLACE FUNCTION public.get_auth_school_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT school_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_school_admin(target_school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND (
        is_super_admin = true
        OR (role = 'admin' AND approval_status = 'approved' AND school_id = target_school_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND is_super_admin = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_school_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_school_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;


-- ── 1. HARDEN SCHOOL_ORDERS RLS ──────────────────────────────────────────────
ALTER TABLE public.school_orders ENABLE ROW LEVEL SECURITY;

-- Drop all historical / permissive policies
DROP POLICY IF EXISTS "Anyone can create school orders" ON public.school_orders;
DROP POLICY IF EXISTS "Anyone can view orders" ON public.school_orders;
DROP POLICY IF EXISTS "Anyone can update orders" ON public.school_orders;
DROP POLICY IF EXISTS "Super admin can view orders" ON public.school_orders;
DROP POLICY IF EXISTS "Super admin can update orders" ON public.school_orders;
DROP POLICY IF EXISTS "school_orders_access" ON public.school_orders;
DROP POLICY IF EXISTS "school_orders_super_admin_all" ON public.school_orders;
DROP POLICY IF EXISTS "school_orders_admin" ON public.school_orders;
DROP POLICY IF EXISTS "school_orders_anyone_insert" ON public.school_orders;
DROP POLICY IF EXISTS "school_orders_valid_fields_insert" ON public.school_orders;
DROP POLICY IF EXISTS "school_orders_anon_insert_pending" ON public.school_orders;
DROP POLICY IF EXISTS "school_orders_super_admin_manage" ON public.school_orders;

-- Revoke dangerous table grants
REVOKE ALL ON public.school_orders FROM anon, authenticated;
GRANT INSERT ON public.school_orders TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.school_orders TO authenticated;
GRANT ALL ON public.school_orders TO service_role;

-- 🛡️ Policy 1: Anon / Authenticated can only insert a NEW pending order
CREATE POLICY "school_orders_anon_insert_pending" ON public.school_orders
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'pending' OR status IS NULL
  );

-- 🛡️ Policy 2: ONLY Super Admin can read, approve, reject, or manage school orders
CREATE POLICY "school_orders_super_admin_manage" ON public.school_orders
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());


-- ── 2. HARDEN USER_ROLES RLS (Zero-Recursion) ────────────────────────────────
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Drop insecure anon policies and recursive policies
DROP POLICY IF EXISTS "user_roles_insert_signup" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_anon_read" ON public.user_roles;
DROP POLICY IF EXISTS "Allow public read for roles during login" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_view_own" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_manage_school" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_super_admin" ON public.user_roles;

-- Revoke anon access from user_roles
REVOKE ALL ON public.user_roles FROM anon;
GRANT SELECT, UPDATE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- 🛡️ Policy 1: Authenticated user can view only their own role
CREATE POLICY "user_roles_view_own" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 🛡️ Policy 2: School Admin can manage user roles strictly within their own school (via Security Definer helper)
CREATE POLICY "user_roles_admin_manage_school" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_school_admin(school_id))
  WITH CHECK (public.is_school_admin(school_id));

-- 🛡️ Policy 3: Super Admin full access
CREATE POLICY "user_roles_super_admin" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());


-- ── 3. HARDEN PROFILES RLS ──────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop insecure anon policies
DROP POLICY IF EXISTS "profiles_insert_signup" ON public.profiles;
DROP POLICY IF EXISTS "profiles_anon_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_anon_signup" ON public.profiles;
DROP POLICY IF EXISTS "profiles_view_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_manage_school" ON public.profiles;
DROP POLICY IF EXISTS "profiles_super_admin" ON public.profiles;

-- Revoke anon access from profiles
REVOKE ALL ON public.profiles FROM anon;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 🛡️ Policy 1: Authenticated user can view their own profile or users in the same school
CREATE POLICY "profiles_view_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (school_id IS NOT NULL AND school_id = public.get_auth_school_id())
    OR public.is_super_admin()
  );

-- 🛡️ Policy 2: Authenticated user can update their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 🛡️ Policy 3: School Admin can manage profiles within their school
CREATE POLICY "profiles_admin_manage_school" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_school_admin(school_id))
  WITH CHECK (public.is_school_admin(school_id));

-- 🛡️ Policy 4: Super Admin full access
CREATE POLICY "profiles_super_admin" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());


-- ── 4. HARDEN SCHOOLS RLS ───────────────────────────────────────────────────
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schools_read_all" ON public.schools;
DROP POLICY IF EXISTS "schools_anon_read_all" ON public.schools;
DROP POLICY IF EXISTS "schools_public_read_active" ON public.schools;
DROP POLICY IF EXISTS "schools_admin_manage" ON public.schools;

-- 🛡️ Policy 1: Public can read basic school info for active schools (for login / branding)
CREATE POLICY "schools_public_read_active" ON public.schools
  FOR SELECT TO anon, authenticated
  USING (status = 'active');

-- 🛡️ Policy 2: Super Admin full manage access
CREATE POLICY "schools_admin_manage" ON public.schools
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
