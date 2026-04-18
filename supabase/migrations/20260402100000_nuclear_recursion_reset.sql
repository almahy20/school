-- Migration: 20260402100000_nuclear_recursion_reset
-- WARNING: This migration resets ALL RLS policies and helper functions to fix recursion.

-- 1. Create the PRIVATE lookup schema
CREATE SCHEMA IF NOT EXISTS internal;

-- 2. Create the non-recursive, RLS-bypassing lookup functions
-- Using SECURITY DEFINER and owned by postgres is the key to bypassing RLS safely.

CREATE OR REPLACE FUNCTION internal.get_user_school_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Direct SELECT from profiles - bypassing recursive RLS because of SECURITY DEFINER
  SELECT school_id FROM public.profiles WHERE id = p_user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION internal.get_user_role(p_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Direct SELECT from user_roles
  SELECT role::text FROM public.user_roles WHERE user_id = p_user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION internal.get_user_approval_status(p_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT approval_status::text FROM public.user_roles WHERE user_id = p_user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION internal.is_user_super_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(is_super_admin, false) FROM public.user_roles WHERE user_id = p_user_id LIMIT 1;
$$;

-- 3. Create the PUBLIC helper functions that call the INTERNAL ones
-- These functions do NOT SELECT from tables directly, so they are safe to use in policies.

CREATE OR REPLACE FUNCTION public.get_my_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT internal.get_user_school_id(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT internal.get_user_role(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT internal.is_user_super_admin(auth.uid());
$$;

-- 4. CLEANUP: Drop ALL existing problematic policies to start fresh
DO $$ 
DECLARE 
    r record;
BEGIN
    FOR r IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND (policyname LIKE '%isolation%' OR policyname LIKE '%admin%' OR policyname LIKE '%School admins%')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- 5. APPLY NEAT, NON-RECURSIVE POLICIES

-- A. Schools Table
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schools_role_based_access" ON public.schools
FOR ALL TO authenticated
USING (
  public.is_super_admin() 
  OR id = public.get_my_school_id()
  OR (public.get_my_role() IS NULL) -- Allow users with no role yet (onboarding) to see schools
);

-- B. Profiles Table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_role_based_access" ON public.profiles
FOR ALL TO authenticated
USING (
  id = auth.uid() -- Can see own
  OR public.is_super_admin() 
  OR (school_id = public.get_my_school_id() AND public.get_my_role() = 'admin') -- Admin sees school
);

-- C. User Roles Table
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_role_based_access" ON public.user_roles
FOR ALL TO authenticated
USING (
  user_id = auth.uid() -- Can see own
  OR public.is_super_admin() 
  OR (school_id = public.get_my_school_id() AND public.get_my_role() = 'admin') -- Admin sees school
);

-- D. Generic Table Policy (Classes, Students, Attendance, etc.)
-- We'll apply a standard isolation to all data tables
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN 
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('students', 'classes', 'attendance', 'grades', 'fees', 'fee_payments', 'complaints', 'messages', 'student_parents')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "isolation_policy" ON public.%I;', t);
        EXECUTE format('CREATE POLICY "isolation_policy" ON public.%I FOR ALL TO authenticated USING ( public.is_super_admin() OR school_id = public.get_my_school_id() );', t);
    END LOOP;
END $$;

-- 6. Add special exception for guest signup (Allow reading schools for signup)
DROP POLICY IF EXISTS "allow_anon_read_schools" ON public.schools;
CREATE POLICY "allow_anon_read_schools" ON public.schools FOR SELECT TO anon, authenticated USING (true);

NOTIFY pgrst, 'reload schema';
