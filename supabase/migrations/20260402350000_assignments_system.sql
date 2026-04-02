-- Create assignments table
CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Create assignments submissions table
CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded', 'late')),
    file_url TEXT,
    grade NUMERIC,
    feedback TEXT,
    submitted_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Assignments RLS
CREATE POLICY "assignments_select_policy"
ON public.assignments FOR SELECT
USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid()) OR
    (SELECT is_super_admin FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) = true
);

CREATE POLICY "assignments_insert_policy"
ON public.assignments FOR INSERT
WITH CHECK (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid()) AND
    ((SELECT role FROM public.user_roles WHERE user_id = auth.uid() AND school_id = assignments.school_id AND approval_status = 'approved' LIMIT 1) IN ('admin', 'teacher') OR
    (SELECT is_super_admin FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) = true)
);

CREATE POLICY "assignments_update_policy"
ON public.assignments FOR UPDATE
USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid()) AND
    ((SELECT role FROM public.user_roles WHERE user_id = auth.uid() AND school_id = assignments.school_id AND approval_status = 'approved' LIMIT 1) IN ('admin', 'teacher') OR
    (SELECT is_super_admin FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) = true)
);

CREATE POLICY "assignments_delete_policy"
ON public.assignments FOR DELETE
USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid()) AND
    ((SELECT role FROM public.user_roles WHERE user_id = auth.uid() AND school_id = assignments.school_id AND approval_status = 'approved' LIMIT 1) IN ('admin', 'teacher') OR
    (SELECT is_super_admin FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) = true)
);

-- Submissions RLS
CREATE POLICY "submissions_select_policy"
ON public.submissions FOR SELECT
USING (
    (SELECT school_id FROM public.assignments WHERE id = assignment_id) = (SELECT school_id FROM public.profiles WHERE id = auth.uid()) OR
    (SELECT is_super_admin FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) = true
);

CREATE POLICY "submissions_insert_policy"
ON public.submissions FOR INSERT
WITH CHECK (
    (SELECT school_id FROM public.assignments WHERE id = assignment_id) = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "submissions_update_policy"
ON public.submissions FOR UPDATE
USING (
    (SELECT school_id FROM public.assignments WHERE id = assignment_id) = (SELECT school_id FROM public.profiles WHERE id = auth.uid()) AND
    ((SELECT role FROM public.user_roles WHERE user_id = auth.uid() AND school_id = (SELECT school_id FROM public.assignments WHERE id = assignment_id) AND approval_status = 'approved' LIMIT 1) IN ('admin', 'teacher') OR
    (SELECT is_super_admin FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) = true)
);

CREATE POLICY "submissions_delete_policy"
ON public.submissions FOR DELETE
USING (
    (SELECT school_id FROM public.assignments WHERE id = assignment_id) = (SELECT school_id FROM public.profiles WHERE id = auth.uid()) AND
    ((SELECT role FROM public.user_roles WHERE user_id = auth.uid() AND school_id = (SELECT school_id FROM public.assignments WHERE id = assignment_id) AND approval_status = 'approved' LIMIT 1) IN ('admin', 'teacher') OR
    (SELECT is_super_admin FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) = true)
);

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
