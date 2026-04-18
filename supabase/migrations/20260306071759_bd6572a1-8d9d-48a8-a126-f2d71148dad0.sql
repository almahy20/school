
-- ============================================
-- Fix ALL RLS policies: RESTRICTIVE → PERMISSIVE
-- Fix infinite recursion in classes table
-- ============================================

-- 1. Create helper function to avoid recursion
CREATE OR REPLACE FUNCTION public.get_teacher_class_ids(_teacher_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.classes WHERE teacher_id = _teacher_id
$$;

CREATE OR REPLACE FUNCTION public.get_parent_student_ids(_parent_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT student_id FROM public.student_parents WHERE parent_id = _parent_id
$$;

-- ============================================
-- DROP ALL EXISTING POLICIES
-- ============================================

-- classes
DROP POLICY IF EXISTS "Admins full access classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can view their classes" ON public.classes;
DROP POLICY IF EXISTS "Parents can view classes of their children" ON public.classes;

-- students
DROP POLICY IF EXISTS "Admins full access students" ON public.students;
DROP POLICY IF EXISTS "Teachers can view students in their classes" ON public.students;
DROP POLICY IF EXISTS "Parents can view their linked children" ON public.students;

-- grades
DROP POLICY IF EXISTS "Admins full access grades" ON public.grades;
DROP POLICY IF EXISTS "Teachers can manage grades for their students" ON public.grades;
DROP POLICY IF EXISTS "Parents can view their children grades" ON public.grades;

-- attendance
DROP POLICY IF EXISTS "Admins full access attendance" ON public.attendance;
DROP POLICY IF EXISTS "Teachers can manage attendance for their students" ON public.attendance;
DROP POLICY IF EXISTS "Parents can view their children attendance" ON public.attendance;

-- student_parents
DROP POLICY IF EXISTS "Admins full access student_parents" ON public.student_parents;
DROP POLICY IF EXISTS "Parents can view their own links" ON public.student_parents;

-- profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- user_roles
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

-- children
DROP POLICY IF EXISTS "Admins can view all children" ON public.children;
DROP POLICY IF EXISTS "Parents can view their own children" ON public.children;
DROP POLICY IF EXISTS "Admins can manage children insert" ON public.children;
DROP POLICY IF EXISTS "Admins can manage children update" ON public.children;
DROP POLICY IF EXISTS "Admins can manage children delete" ON public.children;
DROP POLICY IF EXISTS "Parents can insert their own children" ON public.children;
DROP POLICY IF EXISTS "Parents can update their own children" ON public.children;
DROP POLICY IF EXISTS "Parents can delete their own children" ON public.children;

-- ============================================
-- RECREATE ALL POLICIES AS PERMISSIVE
-- ============================================

-- CLASSES (using security definer functions to avoid recursion)
CREATE POLICY "Admins full access classes" ON public.classes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers can view their classes" ON public.classes FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "Parents can view classes of their children" ON public.classes FOR SELECT TO authenticated
  USING (id IN (
    SELECT s.class_id FROM public.students s
    WHERE s.id IN (SELECT public.get_parent_student_ids(auth.uid()))
  ));

-- STUDENTS
CREATE POLICY "Admins full access students" ON public.students FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers can view students in their classes" ON public.students FOR SELECT TO authenticated
  USING (class_id IN (SELECT public.get_teacher_class_ids(auth.uid())));

CREATE POLICY "Parents can view their linked children" ON public.students FOR SELECT TO authenticated
  USING (id IN (SELECT public.get_parent_student_ids(auth.uid())));

-- GRADES
CREATE POLICY "Admins full access grades" ON public.grades FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers can manage grades for their students" ON public.grades FOR ALL TO authenticated
  USING (student_id IN (
    SELECT s.id FROM public.students s
    WHERE s.class_id IN (SELECT public.get_teacher_class_ids(auth.uid()))
  ))
  WITH CHECK (student_id IN (
    SELECT s.id FROM public.students s
    WHERE s.class_id IN (SELECT public.get_teacher_class_ids(auth.uid()))
  ));

CREATE POLICY "Parents can view their children grades" ON public.grades FOR SELECT TO authenticated
  USING (student_id IN (SELECT public.get_parent_student_ids(auth.uid())));

-- ATTENDANCE
CREATE POLICY "Admins full access attendance" ON public.attendance FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers can manage attendance for their students" ON public.attendance FOR ALL TO authenticated
  USING (student_id IN (
    SELECT s.id FROM public.students s
    WHERE s.class_id IN (SELECT public.get_teacher_class_ids(auth.uid()))
  ))
  WITH CHECK (student_id IN (
    SELECT s.id FROM public.students s
    WHERE s.class_id IN (SELECT public.get_teacher_class_ids(auth.uid()))
  ));

CREATE POLICY "Parents can view their children attendance" ON public.attendance FOR SELECT TO authenticated
  USING (student_id IN (SELECT public.get_parent_student_ids(auth.uid())));

-- STUDENT_PARENTS
CREATE POLICY "Admins full access student_parents" ON public.student_parents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Parents can view their own links" ON public.student_parents FOR SELECT TO authenticated
  USING (parent_id = auth.uid());

-- PROFILES
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- USER_ROLES
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- CHILDREN
CREATE POLICY "Admins can view all children" ON public.children FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Parents can view their own children" ON public.children FOR SELECT TO authenticated
  USING (auth.uid() = parent_id);

CREATE POLICY "Admins can manage children" ON public.children FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Parents can insert their own children" ON public.children FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = parent_id);

CREATE POLICY "Parents can update their own children" ON public.children FOR UPDATE TO authenticated
  USING (auth.uid() = parent_id);

CREATE POLICY "Parents can delete their own children" ON public.children FOR DELETE TO authenticated
  USING (auth.uid() = parent_id);
