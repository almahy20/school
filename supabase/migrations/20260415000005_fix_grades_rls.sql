-- Migration: 20260415000005_fix_grades_rls.sql
-- Goal: Ensure all authenticated users in a school can read grades.

ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "grades_select_policy" ON public.grades;
CREATE POLICY "grades_select_policy" 
ON public.grades 
FOR SELECT 
TO authenticated 
USING (
  school_id IN (
    SELECT school_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
  OR public.is_super_admin()
);

NOTIFY pgrst, 'reload schema';
