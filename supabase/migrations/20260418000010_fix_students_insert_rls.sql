-- Migration: 20260418000002_fix_students_insert_rls.sql
-- Date: 2026-04-18
-- Goal: Fix 403 error when inserting/updating students
-- Issue: Row-level security policy blocking student creation

-- Enable RLS on students table
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Drop old conflicting policies
DROP POLICY IF EXISTS "students_isolation_policy" ON public.students;
DROP POLICY IF EXISTS "isolation_policy" ON public.students;
DROP POLICY IF EXISTS "Admins full access students" ON public.students;
DROP POLICY IF EXISTS "Teachers can view students in their classes" ON public.students;
DROP POLICY IF EXISTS "Parents can view their linked children" ON public.students;
DROP POLICY IF EXISTS "Admins full access students" ON public.students;

-- ─── Policy 1: SELECT (All authenticated users in the school) ────────────────
CREATE POLICY "students_select_policy" 
ON public.students 
FOR SELECT 
TO authenticated 
USING (
  -- Super admin can see all students
  public.is_super_admin()
  OR 
  -- Admin/Teacher/Parent can see students in their school
  school_id IN (
    SELECT school_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
  OR 
  -- Parent can see their linked children
  EXISTS (
    SELECT 1 FROM public.student_parents sp
    WHERE sp.student_id = public.students.id
    AND sp.parent_id = auth.uid()
  )
);

-- ─── Policy 2: INSERT (Admins only) ─────────────────────────────────────────
CREATE POLICY "students_insert_policy" 
ON public.students 
FOR INSERT 
TO authenticated 
WITH CHECK (
  -- Admin can insert students in their school
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
      AND school_id = students.school_id 
      AND role = 'admin' 
      AND approval_status = 'approved'
  )
  OR
  -- Super admin can insert anywhere
  public.is_super_admin()
);

-- ─── Policy 3: UPDATE (Admins only) ─────────────────────────────────────────
CREATE POLICY "students_update_policy" 
ON public.students 
FOR UPDATE 
TO authenticated 
USING (
  -- Can only update students in their school
  school_id IN (
    SELECT school_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
  OR public.is_super_admin()
)
WITH CHECK (
  -- Must be admin to update
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
      AND school_id = students.school_id 
      AND role = 'admin' 
      AND approval_status = 'approved'
  )
  OR
  -- Super admin can update anywhere
  public.is_super_admin()
);

-- ─── Policy 4: DELETE (Admins only) ─────────────────────────────────────────
CREATE POLICY "students_delete_policy" 
ON public.students 
FOR DELETE 
TO authenticated 
USING (
  -- Admin can delete students in their school
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
      AND school_id = students.school_id 
      AND role = 'admin' 
      AND approval_status = 'approved'
  )
  OR
  -- Super admin can delete anywhere
  public.is_super_admin()
);

-- ─── Verify Policies ────────────────────────────────────────────────────────
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'students'
ORDER BY policyname;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
