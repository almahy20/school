-- Migration: 20260415000006_fix_grades_insert_rls.sql
-- Date: 2026-04-15
-- Goal: Fix 403 error when inserting/updating grades
-- Issue: Row-level security policy blocking grade creation

-- Enable RLS on grades table
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

-- Drop old conflicting policies
DROP POLICY IF EXISTS "grades_select_policy" ON public.grades;
DROP POLICY IF EXISTS "Admins can manage all grades in their school" ON public.grades;
DROP POLICY IF EXISTS "Teachers can manage grades for their students" ON public.grades;
DROP POLICY IF EXISTS "Parents can view their children grades" ON public.grades;
DROP POLICY IF EXISTS "Grades isolation" ON public.grades;
DROP POLICY IF EXISTS "Admins full access grades" ON public.grades;

-- ─── Policy 1: SELECT (All authenticated users in the school) ────────────────
CREATE POLICY "grades_select_policy" 
ON public.grades 
FOR SELECT 
TO authenticated 
USING (
  -- User belongs to the same school as the grade
  school_id IN (
    SELECT school_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
  OR 
  -- Or user is super admin
  public.is_super_admin()
);

-- ─── Policy 2: INSERT (Admins and Teachers only) ─────────────────────────────
CREATE POLICY "grades_insert_policy" 
ON public.grades 
FOR INSERT 
TO authenticated 
WITH CHECK (
  -- Admin can insert any grade in their school
  (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
        AND school_id = grades.school_id 
        AND role = 'admin' 
        AND approval_status = 'approved'
    )
  )
  OR 
  -- Teacher can insert grades for their students
  (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
        AND school_id = grades.school_id 
        AND role = 'teacher' 
        AND approval_status = 'approved'
    )
    AND
    grades.student_id IN (
      SELECT s.id 
      FROM public.students s
      WHERE s.class_id IN (
        SELECT c.id 
        FROM public.classes c
        WHERE c.teacher_id = auth.uid()
          AND c.school_id = grades.school_id
      )
    )
  )
  OR
  -- Super admin can insert anywhere
  public.is_super_admin()
);

-- ─── Policy 3: UPDATE (Admins and Teachers only) ─────────────────────────────
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
  -- Admin can update any grade in their school
  (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
        AND school_id = grades.school_id 
        AND role = 'admin' 
        AND approval_status = 'approved'
    )
  )
  OR 
  -- Teacher can update grades for their students
  (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
        AND school_id = grades.school_id 
        AND role = 'teacher' 
        AND approval_status = 'approved'
    )
    AND
    grades.student_id IN (
      SELECT s.id 
      FROM public.students s
      WHERE s.class_id IN (
        SELECT c.id 
        FROM public.classes c
        WHERE c.teacher_id = auth.uid()
          AND c.school_id = grades.school_id
      )
    )
  )
  OR
  -- Super admin can update anywhere
  public.is_super_admin()
);

-- ─── Policy 4: DELETE (Admins only) ─────────────────────────────────────────
CREATE POLICY "grades_delete_policy" 
ON public.grades 
FOR DELETE 
TO authenticated 
USING (
  -- Admin can delete grades in their school
  (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
        AND school_id = grades.school_id 
        AND role = 'admin' 
        AND approval_status = 'approved'
    )
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
WHERE tablename = 'grades'
ORDER BY policyname;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
