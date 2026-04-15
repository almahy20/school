-- Migration: 20260415000007_relax_grades_insert_rls.sql
-- Goal: Fix 403 error on grades insert for Teachers
-- Issue: The previous policy restricted teachers to ONLY their homeroom classes (classes.teacher_id = auth.uid()). This blocks subject teachers from submitting grades.

-- Drop the restrictive policies
DROP POLICY IF EXISTS "grades_insert_policy" ON public.grades;
DROP POLICY IF EXISTS "grades_update_policy" ON public.grades;

-- ─── New Policy 2: INSERT (Admins and Teachers) ─────────────────────────────
CREATE POLICY "grades_insert_policy" 
ON public.grades 
FOR INSERT 
TO authenticated 
WITH CHECK (
  -- User must be approved admin or teacher in the same school
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
      AND school_id = grades.school_id 
      AND role IN ('admin', 'teacher')
      AND approval_status = 'approved'
  )
  OR 
  -- Super admin can insert anywhere
  public.is_super_admin()
);

-- ─── New Policy 3: UPDATE (Admins and Teachers) ─────────────────────────────
CREATE POLICY "grades_update_policy" 
ON public.grades 
FOR UPDATE 
TO authenticated 
USING (
  -- Can only update grades in their school
  school_id IN (
    SELECT school_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
  OR public.is_super_admin()
)
WITH CHECK (
  -- User must be approved admin or teacher in the same school
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
      AND school_id = grades.school_id 
      AND role IN ('admin', 'teacher')
      AND approval_status = 'approved'
  )
  OR 
  -- Super admin can update anywhere
  public.is_super_admin()
);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
