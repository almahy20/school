-- ============================================================================
-- Migration: 20260927140000_unify_permissive_rls_policies.sql
-- Description: Unify multiple permissive policies and optimize auth functions with (SELECT auth.uid())
-- ============================================================================

-- 1. PROFILES
DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_read_plain_password_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_unified" ON public.profiles;

CREATE POLICY "profiles_select_unified" ON public.profiles
FOR SELECT TO authenticated
USING (
  id = (SELECT auth.uid())
  OR is_super_admin()
  OR (
    school_id IS NOT NULL 
    AND school_id = (SELECT ur.school_id FROM public.user_roles ur WHERE ur.user_id = (SELECT auth.uid()) LIMIT 1)
  )
);

-- 2. SCHOOLS
DROP POLICY IF EXISTS "anon_read_schools_basic" ON public.schools;
DROP POLICY IF EXISTS "schools_read" ON public.schools;
DROP POLICY IF EXISTS "schools_select_unified" ON public.schools;
DROP POLICY IF EXISTS "schools_manage" ON public.schools;

CREATE POLICY "schools_select_unified" ON public.schools
FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "schools_manage_write" ON public.schools
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = (SELECT auth.uid()) AND user_roles.is_super_admin = true));

CREATE POLICY "schools_manage_modify" ON public.schools
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = (SELECT auth.uid()) AND user_roles.is_super_admin = true))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = (SELECT auth.uid()) AND user_roles.is_super_admin = true));

CREATE POLICY "schools_manage_delete" ON public.schools
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = (SELECT auth.uid()) AND user_roles.is_super_admin = true));

-- 3. STUDENTS
DROP POLICY IF EXISTS "students_select_policy" ON public.students;
DROP POLICY IF EXISTS "students_school_access" ON public.students;
DROP POLICY IF EXISTS "students_select_unified" ON public.students;
DROP POLICY IF EXISTS "students_write_unified" ON public.students;

CREATE POLICY "students_select_unified" ON public.students
FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR school_id = get_auth_school_id()
  OR EXISTS (
    SELECT 1 FROM public.student_parents sp 
    WHERE sp.student_id = students.id AND sp.parent_id = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = (SELECT auth.uid()) AND public.phones_match(students.parent_phone, p.phone)
  )
);

CREATE POLICY "students_insert_unified" ON public.students
FOR INSERT TO authenticated
WITH CHECK (is_super_admin() OR school_id = get_auth_school_id());

CREATE POLICY "students_update_unified" ON public.students
FOR UPDATE TO authenticated
USING (is_super_admin() OR school_id = get_auth_school_id())
WITH CHECK (is_super_admin() OR school_id = get_auth_school_id());

CREATE POLICY "students_delete_unified" ON public.students
FOR DELETE TO authenticated
USING (is_super_admin() OR school_id = get_auth_school_id());

-- 4. TEACHER_ATTENDANCE
DROP POLICY IF EXISTS "ta_access" ON public.teacher_attendance;
DROP POLICY IF EXISTS "teacher_attendance_admin_all" ON public.teacher_attendance;
DROP POLICY IF EXISTS "teacher_attendance_teacher_select" ON public.teacher_attendance;
DROP POLICY IF EXISTS "teacher_attendance_select_unified" ON public.teacher_attendance;
DROP POLICY IF EXISTS "teacher_attendance_write_unified" ON public.teacher_attendance;

CREATE POLICY "teacher_attendance_select_unified" ON public.teacher_attendance
FOR SELECT TO authenticated
USING (
  teacher_id = (SELECT auth.uid())
  OR is_super_admin()
  OR (
    school_id = (
      SELECT ur.school_id FROM public.user_roles ur 
      WHERE ur.user_id = (SELECT auth.uid()) AND ur.role = 'admin' AND ur.approval_status = 'approved' 
      LIMIT 1
    )
  )
);

CREATE POLICY "teacher_attendance_insert_unified" ON public.teacher_attendance
FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin()
  OR (
    school_id = (
      SELECT ur.school_id FROM public.user_roles ur 
      WHERE ur.user_id = (SELECT auth.uid()) AND ur.role = 'admin' AND ur.approval_status = 'approved' 
      LIMIT 1
    )
  )
);

CREATE POLICY "teacher_attendance_update_unified" ON public.teacher_attendance
FOR UPDATE TO authenticated
USING (
  is_super_admin()
  OR (
    school_id = (
      SELECT ur.school_id FROM public.user_roles ur 
      WHERE ur.user_id = (SELECT auth.uid()) AND ur.role = 'admin' AND ur.approval_status = 'approved' 
      LIMIT 1
    )
  )
)
WITH CHECK (
  is_super_admin()
  OR (
    school_id = (
      SELECT ur.school_id FROM public.user_roles ur 
      WHERE ur.user_id = (SELECT auth.uid()) AND ur.role = 'admin' AND ur.approval_status = 'approved' 
      LIMIT 1
    )
  )
);

CREATE POLICY "teacher_attendance_delete_unified" ON public.teacher_attendance
FOR DELETE TO authenticated
USING (
  is_super_admin()
  OR (
    school_id = (
      SELECT ur.school_id FROM public.user_roles ur 
      WHERE ur.user_id = (SELECT auth.uid()) AND ur.role = 'admin' AND ur.approval_status = 'approved' 
      LIMIT 1
    )
  )
);

-- 5. USER_ROLES
DROP POLICY IF EXISTS "user_roles_admin_read" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_anon_select" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_own_select" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_unified" ON public.user_roles;

CREATE POLICY "user_roles_select_unified" ON public.user_roles
FOR SELECT TO anon, authenticated
USING (
  (SELECT auth.role()) = 'anon'
  OR user_id = (SELECT auth.uid())
  OR is_super_admin()
  OR is_school_admin(school_id)
);
