-- Repair RLS for assignments and submissions to match the new optimized system
-- Migration: 20260402360000_repair_assignments_rls

-- 1. Drop old policies
DROP POLICY IF EXISTS "assignments_select_policy" ON public.assignments;
DROP POLICY IF EXISTS "assignments_insert_policy" ON public.assignments;
DROP POLICY IF EXISTS "assignments_update_policy" ON public.assignments;
DROP POLICY IF EXISTS "assignments_delete_policy" ON public.assignments;

DROP POLICY IF EXISTS "submissions_select_policy" ON public.submissions;
DROP POLICY IF EXISTS "submissions_insert_policy" ON public.submissions;
DROP POLICY IF EXISTS "submissions_update_policy" ON public.submissions;
DROP POLICY IF EXISTS "submissions_delete_policy" ON public.submissions;

-- 2. Apply optimized isolation policies
CREATE POLICY "assignments_isolation" ON public.assignments 
FOR ALL TO authenticated 
USING ( public.is_super_admin() OR school_id = public.get_my_school_id() );

CREATE POLICY "submissions_isolation" ON public.submissions 
FOR ALL TO authenticated 
USING ( 
    public.is_super_admin() OR 
    EXISTS (
        SELECT 1 FROM public.assignments 
        WHERE id = assignment_id AND school_id = public.get_my_school_id()
    )
);

-- 3. Grants (Just in case)
GRANT ALL ON public.assignments TO authenticated, service_role;
GRANT ALL ON public.submissions TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
