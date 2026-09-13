-- ==============================================================================
-- Migration: 20260919000000_optimize_database_performance_and_rls.sql
-- Goal: Fix 137,000+ user_roles scans, drop duplicate RLS policies, and add missing indexes
-- ==============================================================================

-- 1. Helper Functions (STABLE, SECURITY DEFINER - cached per statement)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_auth_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF((auth.jwt() -> 'app_metadata' ->> 'school_id'), '')::uuid,
    (SELECT ur.school_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() LIMIT 1),
    (SELECT p.school_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_auth_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    ((auth.jwt() -> 'app_metadata' ->> 'is_super_admin'))::boolean,
    (SELECT ur.is_super_admin FROM public.user_roles ur WHERE ur.user_id = auth.uid() LIMIT 1),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    (SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = auth.uid() LIMIT 1),
    'parent'
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_school_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_is_super_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated, anon;

-- 2. Performance Indexes for Heavy Foreign Keys & RLS Filter Columns
-- ------------------------------------------------------------------------------
-- Classes
CREATE INDEX IF NOT EXISTS idx_classes_school_id ON public.classes(school_id);
CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON public.classes(teacher_id);

-- Students
CREATE INDEX IF NOT EXISTS idx_students_school_class ON public.students(school_id, class_id);
CREATE INDEX IF NOT EXISTS idx_students_created_at_desc ON public.students(created_at DESC);

-- Student Parents
CREATE INDEX IF NOT EXISTS idx_student_parents_student_parent ON public.student_parents(student_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_student_parents_school_parent ON public.student_parents(school_id, parent_id);

-- Exams & Questions & Attempts
CREATE INDEX IF NOT EXISTS idx_electronic_exams_school_id ON public.electronic_exams(school_id);
CREATE INDEX IF NOT EXISTS idx_electronic_exams_class_id ON public.electronic_exams(class_id);
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam_id ON public.exam_questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_student ON public.exam_attempts(exam_id, student_id);

-- Fees & Payments
CREATE INDEX IF NOT EXISTS idx_fees_school_id ON public.fees(school_id);
CREATE INDEX IF NOT EXISTS idx_fees_student_id ON public.fees(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_fee_id ON public.fee_payments(fee_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_school_id ON public.fee_payments(school_id);

-- Attendance & Grades
CREATE INDEX IF NOT EXISTS idx_attendance_school_date ON public.attendance(school_id, date);
CREATE INDEX IF NOT EXISTS idx_grades_student_school ON public.grades(student_id, school_id);

-- Messages & Conversations & Complaints
CREATE INDEX IF NOT EXISTS idx_complaints_school_id ON public.complaints(school_id);
CREATE INDEX IF NOT EXISTS idx_messages_school_id ON public.messages(school_id);
CREATE INDEX IF NOT EXISTS idx_conversations_school_status ON public.conversations(school_id, status);
CREATE INDEX IF NOT EXISTS idx_conv_messages_conv_created ON public.conversation_messages(conversation_id, created_at);


-- 3. Supercharged & Unified RLS Policies
-- ------------------------------------------------------------------------------

-- Classes
DROP POLICY IF EXISTS "classes_school_access" ON public.classes;
CREATE POLICY "classes_school_access" ON public.classes
  FOR ALL TO authenticated
  USING (get_auth_is_super_admin() OR school_id = get_auth_school_id())
  WITH CHECK (get_auth_is_super_admin() OR school_id = get_auth_school_id());

-- Students (Drop duplicate phones_match policy)
DROP POLICY IF EXISTS "students_school_access" ON public.students;
DROP POLICY IF EXISTS "students_select_policy" ON public.students;
CREATE POLICY "students_school_access" ON public.students
  FOR ALL TO authenticated
  USING (
    get_auth_is_super_admin() 
    OR school_id = get_auth_school_id()
    OR EXISTS (
      SELECT 1 FROM public.student_parents sp 
      WHERE sp.student_id = students.id AND sp.parent_id = auth.uid()
    )
  )
  WITH CHECK (
    get_auth_is_super_admin() 
    OR school_id = get_auth_school_id()
  );

-- Attendance
DROP POLICY IF EXISTS "attendance_school_access" ON public.attendance;
CREATE POLICY "attendance_school_access" ON public.attendance
  FOR ALL TO authenticated
  USING (get_auth_is_super_admin() OR school_id = get_auth_school_id())
  WITH CHECK (get_auth_is_super_admin() OR school_id = get_auth_school_id());

-- Grades
DROP POLICY IF EXISTS "grades_school_access" ON public.grades;
CREATE POLICY "grades_school_access" ON public.grades
  FOR ALL TO authenticated
  USING (get_auth_is_super_admin() OR school_id = get_auth_school_id())
  WITH CHECK (get_auth_is_super_admin() OR school_id = get_auth_school_id());

-- Electronic Exams
DROP POLICY IF EXISTS "electronic_exams_school_access" ON public.electronic_exams;
CREATE POLICY "electronic_exams_school_access" ON public.electronic_exams
  FOR ALL TO authenticated
  USING (get_auth_is_super_admin() OR school_id = get_auth_school_id())
  WITH CHECK (get_auth_is_super_admin() OR school_id = get_auth_school_id());

-- Exam Questions
DROP POLICY IF EXISTS "exam_questions_school_access" ON public.exam_questions;
CREATE POLICY "exam_questions_school_access" ON public.exam_questions
  FOR ALL TO authenticated
  USING (get_auth_is_super_admin() OR school_id = get_auth_school_id())
  WITH CHECK (get_auth_is_super_admin() OR school_id = get_auth_school_id());

-- Exam Attempts
DROP POLICY IF EXISTS "exam_attempts_school_access" ON public.exam_attempts;
CREATE POLICY "exam_attempts_school_access" ON public.exam_attempts
  FOR ALL TO authenticated
  USING (
    get_auth_is_super_admin() 
    OR parent_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.electronic_exams ee 
      WHERE ee.id = exam_attempts.exam_id AND ee.school_id = get_auth_school_id()
    )
  )
  WITH CHECK (
    get_auth_is_super_admin() 
    OR parent_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.electronic_exams ee 
      WHERE ee.id = exam_attempts.exam_id AND ee.school_id = get_auth_school_id()
    )
  );

-- Fees
DROP POLICY IF EXISTS "fees_school_access" ON public.fees;
CREATE POLICY "fees_school_access" ON public.fees
  FOR ALL TO authenticated
  USING (get_auth_is_super_admin() OR school_id = get_auth_school_id())
  WITH CHECK (get_auth_is_super_admin() OR school_id = get_auth_school_id());

-- Fee Payments
DROP POLICY IF EXISTS "fee_payments_school_access" ON public.fee_payments;
CREATE POLICY "fee_payments_school_access" ON public.fee_payments
  FOR ALL TO authenticated
  USING (get_auth_is_super_admin() OR school_id = get_auth_school_id())
  WITH CHECK (get_auth_is_super_admin() OR school_id = get_auth_school_id());

-- Student Parents
DROP POLICY IF EXISTS "student_parents_access" ON public.student_parents;
CREATE POLICY "student_parents_access" ON public.student_parents
  FOR ALL TO authenticated
  USING (
    get_auth_is_super_admin() 
    OR school_id = get_auth_school_id() 
    OR parent_id = auth.uid()
  )
  WITH CHECK (
    get_auth_is_super_admin() 
    OR school_id = get_auth_school_id() 
    OR parent_id = auth.uid()
  );

-- Complaints
DROP POLICY IF EXISTS "complaints_school_access" ON public.complaints;
CREATE POLICY "complaints_school_access" ON public.complaints
  FOR ALL TO authenticated
  USING (
    get_auth_is_super_admin() 
    OR school_id = get_auth_school_id() 
    OR user_id = auth.uid()
  )
  WITH CHECK (
    get_auth_is_super_admin() 
    OR school_id = get_auth_school_id() 
    OR user_id = auth.uid()
  );

-- Notifications
DROP POLICY IF EXISTS "notif_access" ON public.notifications;
CREATE POLICY "notif_access" ON public.notifications
  FOR ALL TO authenticated
  USING (
    get_auth_is_super_admin() 
    OR user_id = auth.uid()
    OR (school_id = get_auth_school_id() AND get_auth_role() = 'admin')
  )
  WITH CHECK (
    get_auth_is_super_admin() 
    OR (school_id = get_auth_school_id() AND get_auth_role() = 'admin')
  );

-- Class Chat Rooms
DROP POLICY IF EXISTS "class_chat_rooms_school_access" ON public.class_chat_rooms;
CREATE POLICY "class_chat_rooms_school_access" ON public.class_chat_rooms
  FOR ALL TO authenticated
  USING (get_auth_is_super_admin() OR school_id = get_auth_school_id())
  WITH CHECK (get_auth_is_super_admin() OR school_id = get_auth_school_id());
