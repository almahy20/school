-- ==============================================================================
-- Migration: 20261021210000_unify_school_admin_rls_and_reveal_data.sql
-- Purpose  : حل مشكلة عدم ظهور البيانات (الطلاب، الفصول، أولياء الأمور، الملفات الشخصية):
--            1. تحديث get_auth_school_id ليتخطى الصفوف التي تحوي school_id = NULL
--            2. تحديث is_school_admin لدعم مدراء المدارس والسوبر أدمن بشكل كامل
--            3. توحيد سياسات RLS لجداول (students, classes, profiles, user_roles)
--               بحيث تسمح لمدير المدرسة (is_school_admin) برؤية بيانات مدرسته دائماً
--            4. إعادة تحميل كاش PostgREST
-- ==============================================================================

SET search_path TO public;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. تحديث get_auth_school_id لتخطي أي قيم NULL في user_roles أو profiles
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_auth_school_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF((auth.jwt() -> 'app_metadata' ->> 'school_id'), '')::uuid,
    (SELECT ur.school_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.school_id IS NOT NULL LIMIT 1),
    (SELECT p.school_id FROM public.profiles p WHERE p.id = auth.uid() AND p.school_id IS NOT NULL LIMIT 1),
    (SELECT sp.school_id FROM public.student_parents sp WHERE sp.parent_id = auth.uid() AND sp.school_id IS NOT NULL LIMIT 1)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_school_id() TO anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. تحديث is_school_admin لدعم كافة حالات الإدارة
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_school_admin(target_school_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND (
        is_super_admin = TRUE
        OR (
          role = 'admin' 
          AND approval_status = 'approved' 
          AND (school_id = target_school_id OR target_school_id IS NULL OR school_id IS NULL)
        )
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_school_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND (
        is_super_admin = TRUE
        OR (role = 'admin' AND approval_status = 'approved')
      )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_school_admin(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_school_admin() TO anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. توحيد سياسات الـ RLS لفتح البيانات للإدارة والمعلمين والطلاب
-- ─────────────────────────────────────────────────────────────────────────────

-- A. الفصول (classes)
DROP POLICY IF EXISTS "classes_school_access" ON public.classes;
DROP POLICY IF EXISTS "Classes isolation" ON public.classes;
DROP POLICY IF EXISTS "isolation_policy" ON public.classes;
DROP POLICY IF EXISTS "Admins full access classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can view their classes" ON public.classes;
DROP POLICY IF EXISTS "Parents can view classes of their children" ON public.classes;

CREATE POLICY "classes_school_access" ON public.classes
FOR ALL TO authenticated
USING (
  is_super_admin()
  OR is_school_admin(school_id)
  OR school_id = get_auth_school_id()
  OR teacher_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.class_id = classes.id
      AND (
        s.id IN (SELECT sp.student_id FROM public.student_parents sp WHERE sp.parent_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND public.phones_match(s.parent_phone, p.phone)
        )
      )
  )
)
WITH CHECK (
  is_super_admin()
  OR is_school_admin(school_id)
  OR school_id = get_auth_school_id()
);

-- B. الطلاب (students)
DROP POLICY IF EXISTS "students_select_unified" ON public.students;
DROP POLICY IF EXISTS "students_school_access" ON public.students;
DROP POLICY IF EXISTS "Students isolation" ON public.students;
DROP POLICY IF EXISTS "isolation_policy" ON public.students;
DROP POLICY IF EXISTS "Admins full access students" ON public.students;
DROP POLICY IF EXISTS "Teachers can view students in their classes" ON public.students;
DROP POLICY IF EXISTS "Parents can view their linked children" ON public.students;

CREATE POLICY "students_select_unified" ON public.students
FOR SELECT TO authenticated
USING (
  is_super_admin()
  OR is_school_admin(school_id)
  OR school_id = get_auth_school_id()
  OR EXISTS (
    SELECT 1 FROM public.student_parents sp 
    WHERE sp.student_id = students.id AND sp.parent_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND public.phones_match(students.parent_phone, p.phone)
  )
);

DROP POLICY IF EXISTS "students_write_unified" ON public.students;
CREATE POLICY "students_write_unified" ON public.students
FOR ALL TO authenticated
USING (
  is_super_admin()
  OR is_school_admin(school_id)
  OR school_id = get_auth_school_id()
)
WITH CHECK (
  is_super_admin()
  OR is_school_admin(school_id)
  OR school_id = get_auth_school_id()
);

-- C. الملفات الشخصية (profiles)
DROP POLICY IF EXISTS "profiles_select_unified" ON public.profiles;
DROP POLICY IF EXISTS "profiles_view_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_manage_school" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select_unified" ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR is_super_admin()
  OR is_school_admin(school_id)
  OR school_id = get_auth_school_id()
);

-- D. أدوار المستخدمين (user_roles)
DROP POLICY IF EXISTS "user_roles_select_unified" ON public.user_roles;
CREATE POLICY "user_roles_select_unified" ON public.user_roles
FOR SELECT TO anon, authenticated
USING (
  (SELECT auth.role()) = 'anon'
  OR user_id = auth.uid()
  OR is_super_admin()
  OR is_school_admin(school_id)
  OR school_id = get_auth_school_id()
);

-- E. أولياء الأمور والروابط (student_parents)
DROP POLICY IF EXISTS "student_parents_access" ON public.student_parents;
DROP POLICY IF EXISTS "isolation_policy" ON public.student_parents;
CREATE POLICY "student_parents_access" ON public.student_parents
FOR ALL TO authenticated
USING (
  is_super_admin()
  OR is_school_admin(school_id)
  OR school_id = get_auth_school_id()
  OR parent_id = auth.uid()
)
WITH CHECK (
  is_super_admin()
  OR is_school_admin(school_id)
  OR school_id = get_auth_school_id()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. تحديث كاش الـ Schema لـ PostgREST
-- ─────────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
