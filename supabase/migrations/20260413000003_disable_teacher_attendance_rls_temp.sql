-- TEMPORARY: Disable RLS for teacher_attendance to debug
-- Re-enable with proper policies in production

ALTER TABLE public.teacher_attendance DISABLE ROW LEVEL SECURITY;

-- GRANT permissions to authenticated users
GRANT ALL ON public.teacher_attendance TO authenticated;
