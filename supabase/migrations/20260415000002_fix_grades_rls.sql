-- Migration: Fix Grades Table RLS Policies
-- Goal: Give parents access to view their children's grades to fix the 403 Forbidden error on Parent Dashboard

-- Make sure RLS is enabled
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

-- 1. Admins have full access
DROP POLICY IF EXISTS "Admins can manage grades" ON public.grades;
CREATE POLICY "Admins can manage grades" ON public.grades
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND (role = 'admin' OR is_super_admin = true)
    )
);

-- 2. Teachers have full access
DROP POLICY IF EXISTS "Teachers can manage grades" ON public.grades;
CREATE POLICY "Teachers can manage grades" ON public.grades
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'teacher'
    )
);

-- 3. Parents can view their children's grades
DROP POLICY IF EXISTS "Parents can view their children's grades" ON public.grades;
CREATE POLICY "Parents can view their children's grades" ON public.grades
FOR SELECT TO authenticated
USING (
    student_id IN (
        SELECT student_id FROM public.student_parents 
        WHERE parent_id = auth.uid()
    )
);

-- 4. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
