-- ==========================================
-- Migration: 20260402233000_super_admin_fixes
-- Fixes: 403 Forbidden (Missing Insert Policy) and 400 Bad Request (FK Naming)
-- ==========================================

-- 1. SCHOOLS RLS POLICIES (Fixes 403 Forbidden on schools POST)
-- We need to allow Super Admins to manage schools
DROP POLICY IF EXISTS "schools_access" ON public.schools;
DROP POLICY IF EXISTS "anon_view_schools" ON public.schools;

-- Anyone (including anon) can see school names for signup/slug lookup
CREATE POLICY "schools_select_all" ON public.schools FOR SELECT TO public USING (true);

-- Super Admins can do anything
CREATE POLICY "super_admin_manage_schools" ON public.schools
    FOR ALL TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- School Admins can update their own school
CREATE POLICY "school_admin_update_own" ON public.schools
    FOR UPDATE TO authenticated
    USING (id = public.get_my_school_id());

-- 2. EXPLICIT FOREIGN KEY NAMING (Fixes 400 Bad Request on Joins)
-- The frontend expects specific constraint names for PostgREST joins.

-- Complaints -> Students
ALTER TABLE public.complaints DROP CONSTRAINT IF EXISTS complaints_student_id_fkey;
ALTER TABLE public.complaints 
    ADD CONSTRAINT complaints_student_id_fkey 
    FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL;

-- Complaints -> Schools
ALTER TABLE public.complaints DROP CONSTRAINT IF EXISTS complaints_school_id_fkey;
ALTER TABLE public.complaints 
    ADD CONSTRAINT complaints_school_id_fkey 
    FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;

-- Profiles -> Schools
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_school_id_fkey;
ALTER TABLE public.profiles 
    ADD CONSTRAINT profiles_school_id_fkey 
    FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE SET NULL;

-- Students -> Schools
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_school_id_fkey;
ALTER TABLE public.students 
    ADD CONSTRAINT students_school_id_fkey 
    FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;

-- Students -> Classes
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_class_id_fkey;
ALTER TABLE public.students 
    ADD CONSTRAINT students_class_id_fkey 
    FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL;

-- 3. PERMISSION REFRESH
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
