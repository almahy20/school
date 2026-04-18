-- ======================================================
-- Fix Teacher Access to Parent Profiles
-- ======================================================
-- Teachers need to view parent profiles for students in their classes
-- This migration adds a permissive SELECT policy for teachers

-- Drop old conflicting policies
DROP POLICY IF EXISTS "profiles_access_policy" ON public.profiles;

-- Create comprehensive policy for all authenticated users
CREATE POLICY "profiles_view_policy" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    -- 1. Users can view their own profile
    id = auth.uid()
    
    OR
    
    -- 2. Super admins can view everything
    public.is_super_admin()
    
    OR
    
    -- 3. Admins can view all profiles in their school
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
      AND ur.approval_status = 'approved'
      AND ur.school_id = profiles.school_id
    )
    
    OR
    
    -- 4. Teachers can view parent profiles for students in their classes
    EXISTS (
      SELECT 1 FROM public.student_parents sp
      INNER JOIN public.students s ON s.id = sp.student_id
      INNER JOIN public.classes c ON c.id = s.class_id
      WHERE c.teacher_id = auth.uid()
      AND sp.parent_id = profiles.id
    )
    
    OR
    
    -- 5. Parents can view their own profile (redundant but explicit)
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'parent'
      AND profiles.id = auth.uid()
    )
  );

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
