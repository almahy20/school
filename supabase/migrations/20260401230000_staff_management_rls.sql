-- Migration: staff_management_rls
-- Allow school admins to manage their own teachers and parents.

-- 1. Ensure RLS on profiles and user_roles is robust
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies and replace with SaaS-aware ones
-- For user_roles
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;

CREATE POLICY "School admins can manage their own school's roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  -- Either I'm looking at my own role
  auth.uid() = user_id
  OR 
  -- Or I'm an admin of the SAME school as the role I'm managing
  EXISTS (
    SELECT 1 FROM public.user_roles AS my_role
    WHERE my_role.user_id = auth.uid() 
      AND my_role.role = 'admin' 
      AND my_role.school_id = public.user_roles.school_id
  )
);

-- For profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "School admins can view all profiles in their school"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Either my own profile
  auth.uid() = id
  OR 
  -- Or I'm an admin of the same school
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin' 
      AND user_roles.school_id = public.profiles.school_id
  )
);

-- Allow admins to update profiles in their school (e.g. edit teacher name)
DROP POLICY IF EXISTS "Admins can update all profiles in their school" ON public.profiles;
CREATE POLICY "Admins can update all profiles in their school"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin' 
      AND user_roles.school_id = public.profiles.school_id
  )
);

-- Refresh schema
NOTIFY pgrst, 'reload schema';
