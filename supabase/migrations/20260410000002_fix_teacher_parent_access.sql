-- Fix RLS: Allow teachers to view parent profiles of students in their classes
-- This is needed for the teacher messaging feature

-- Drop old restrictive policy if exists
DROP POLICY IF EXISTS "profiles_isolation_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_access_policy" ON public.profiles;

-- Create new permissive policy that allows:
-- 1. Users to view their own profile
-- 2. Admins to view all profiles in their school
-- 3. Teachers to view profiles of parents whose children are in their classes
CREATE POLICY "profiles_access_policy" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    -- Users can view their own profile
    id = auth.uid()
    
    OR
    
    -- Super admins can view everything
    public.is_super_admin()
    
    OR
    
    -- School admins can view profiles in their school
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
      AND ur.school_id = profiles.school_id
    )
    
    OR
    
    -- Teachers can view profiles of parents whose children are in their classes
    EXISTS (
      SELECT 1 FROM public.student_parents sp
      INNER JOIN public.students s ON s.id = sp.student_id
      INNER JOIN public.classes c ON c.id = s.class_id
      WHERE sp.parent_id = profiles.id
      AND c.teacher_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
