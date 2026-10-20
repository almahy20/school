-- ==============================================================================
-- Migration: 20261020210000_fix_parent_exams_access_and_rls.sql
-- Purpose  : حل جذري وشامل لمشكلة "لا تملك صلاحيات الوصول" عند دخول أولياء الأمور للاختبارات
--            1. تحديث get_auth_school_id لجلب المدرسة من student_parents إذا كانت فارغة
--            2. تصحيح سياسات RLS لـ electronic_exams و exam_questions و student_parents
--            3. إنشاء/تحديث الـ View الآمن student_exam_questions
--            4. إنشاء دالة RPC فائقة السرعة get_parent_electronic_exams (SECURITY DEFINER)
--            5. ضمان وجود وتصريح دالة get_exam_review_questions للمراجعة بعد التسليم
-- ==============================================================================

SET search_path TO public;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. تحديث دالة get_auth_school_id() لتشمل student_parents كخطة بديلة لأولياء الأمور
-- ─────────────────────────────────────────────────────────────────────────────
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
    (SELECT p.school_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1),
    (SELECT sp.school_id FROM public.student_parents sp WHERE sp.parent_id = auth.uid() LIMIT 1)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_school_id() TO authenticated, anon;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. تحديث سياسات RLS لـ student_parents (للسماح بالاستعلام والإصلاح التلقائي)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.student_parents ENABLE ROW LEVEL SECURITY;

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


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. تحديث سياسات RLS لـ classes (للسماح لأولياء الأمور برؤية فصول أبنائهم)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "classes_school_access" ON public.classes;
CREATE POLICY "classes_school_access" ON public.classes
  FOR ALL TO authenticated
  USING (
    get_auth_is_super_admin() 
    OR school_id = get_auth_school_id()
    OR EXISTS (
      SELECT 1 FROM public.student_parents sp
      JOIN public.students s ON s.id = sp.student_id
      WHERE sp.parent_id = auth.uid() AND s.class_id = classes.id
    )
  )
  WITH CHECK (
    get_auth_is_super_admin() 
    OR (school_id = get_auth_school_id() AND get_auth_role() IN ('admin', 'teacher'))
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. إعادة بناء سياسات RLS لـ electronic_exams
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.electronic_exams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "elexam_admin_all" ON public.electronic_exams;
DROP POLICY IF EXISTS "elexam_parent_select" ON public.electronic_exams;
DROP POLICY IF EXISTS "elexam_super_admin" ON public.electronic_exams;
DROP POLICY IF EXISTS "electronic_exams_school_access" ON public.electronic_exams;
DROP POLICY IF EXISTS "electronic_exams_select_unified" ON public.electronic_exams;
DROP POLICY IF EXISTS "electronic_exams_write_unified" ON public.electronic_exams;

-- أولياء الأمور والطلاب يمكنهم قراءة الاختبارات المنشورة لفصولهم أو مدرستهم
CREATE POLICY "electronic_exams_select_unified" ON public.electronic_exams
  FOR SELECT TO authenticated
  USING (
    get_auth_is_super_admin()
    OR school_id = get_auth_school_id()
    OR (
      status = 'published' AND (
        EXISTS (
          SELECT 1 FROM public.student_parents sp
          JOIN public.students s ON s.id = sp.student_id
          WHERE sp.parent_id = auth.uid() AND s.class_id = electronic_exams.class_id
        )
        OR EXISTS (
          SELECT 1 FROM public.students s
          JOIN public.profiles p ON p.id = auth.uid()
          WHERE s.class_id = electronic_exams.class_id AND public.phones_match(s.parent_phone, p.phone)
        )
      )
    )
  );

-- الإدارة والمعلمون والسوبر أدمن يمكنهم الإنشاء والتعديل والحذف
CREATE POLICY "electronic_exams_write_unified" ON public.electronic_exams
  FOR ALL TO authenticated
  USING (
    get_auth_is_super_admin()
    OR (
      school_id = get_auth_school_id()
      AND get_auth_role() IN ('admin', 'teacher')
    )
  )
  WITH CHECK (
    get_auth_is_super_admin()
    OR (
      school_id = get_auth_school_id()
      AND get_auth_role() IN ('admin', 'teacher')
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. إعادة بناء سياسات RLS لـ exam_questions
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "examq_admin_all" ON public.exam_questions;
DROP POLICY IF EXISTS "examq_parent_select" ON public.exam_questions;
DROP POLICY IF EXISTS "examq_super_admin" ON public.exam_questions;
DROP POLICY IF EXISTS "exam_questions_school_access" ON public.exam_questions;
DROP POLICY IF EXISTS "exam_questions_staff_manage" ON public.exam_questions;
DROP POLICY IF EXISTS "exam_questions_select_unified" ON public.exam_questions;
DROP POLICY IF EXISTS "exam_questions_write_unified" ON public.exam_questions;

CREATE POLICY "exam_questions_select_unified" ON public.exam_questions
  FOR SELECT TO authenticated
  USING (
    get_auth_is_super_admin()
    OR school_id = get_auth_school_id()
    OR EXISTS (
      SELECT 1 FROM public.electronic_exams ee
      WHERE ee.id = exam_questions.exam_id
        AND ee.status = 'published'
        AND (
          ee.school_id = get_auth_school_id()
          OR EXISTS (
            SELECT 1 FROM public.student_parents sp
            JOIN public.students s ON s.id = sp.student_id
            WHERE sp.parent_id = auth.uid() AND s.class_id = ee.class_id
          )
          OR EXISTS (
            SELECT 1 FROM public.students s
            JOIN public.profiles p ON p.id = auth.uid()
            WHERE s.class_id = ee.class_id AND public.phones_match(s.parent_phone, p.phone)
          )
        )
    )
  );

CREATE POLICY "exam_questions_write_unified" ON public.exam_questions
  FOR ALL TO authenticated
  USING (
    get_auth_is_super_admin()
    OR (
      school_id = get_auth_school_id()
      AND get_auth_role() IN ('admin', 'teacher')
    )
  )
  WITH CHECK (
    get_auth_is_super_admin()
    OR (
      school_id = get_auth_school_id()
      AND get_auth_role() IN ('admin', 'teacher')
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. إنشاء أو تحديث View الآمن student_exam_questions (بدون correct_answer)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.student_exam_questions 
WITH (security_invoker = true)
AS
SELECT 
  q.id,
  q.exam_id,
  q.school_id,
  q.question_type,
  q.question_text,
  q.options,
  q.order_index,
  q.created_at
FROM public.exam_questions q
JOIN public.electronic_exams ee ON ee.id = q.exam_id
WHERE 
  public.get_auth_is_super_admin()
  OR (
    ee.status = 'published'
    AND (
      public.get_auth_role() IN ('admin', 'teacher')
      OR q.school_id = public.get_auth_school_id()
      OR EXISTS (
        SELECT 1
        FROM public.student_parents sp
        JOIN public.students s ON s.id = sp.student_id
        WHERE sp.parent_id = auth.uid()
          AND s.class_id = ee.class_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.students s
        JOIN public.profiles p ON p.id = auth.uid()
        WHERE s.class_id = ee.class_id
          AND public.phones_match(s.parent_phone, p.phone)
      )
    )
  );

GRANT SELECT ON public.student_exam_questions TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. إنشاء دالة RPC الشاملة لجلب اختبارات ولي الأمر (SECURITY DEFINER)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_parent_electronic_exams(
  p_parent_id UUID,
  p_school_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH parent_students AS (
    SELECT DISTINCT s.id AS student_id, s.name AS student_name, s.class_id, c.name AS class_name, s.school_id
    FROM public.students s
    LEFT JOIN public.classes c ON c.id = s.class_id
    WHERE s.id IN (
      SELECT sp.student_id FROM public.student_parents sp WHERE sp.parent_id = p_parent_id
      UNION
      SELECT s2.id FROM public.students s2
      JOIN public.profiles p ON p.id = p_parent_id
      WHERE public.phones_match(s2.parent_phone, p.phone)
    )
  ),
  parent_exams AS (
    SELECT 
      ee.id,
      ee.school_id,
      ee.class_id,
      ee.teacher_id,
      ee.title,
      ee.subject,
      ee.duration_minutes,
      ee.instructions,
      ee.status,
      ee.available_from,
      ee.available_until,
      ee.language,
      ee.created_at,
      ee.updated_at,
      ps.class_name,
      ps.student_id,
      ps.student_name,
      (SELECT COUNT(*)::int FROM public.exam_questions eq WHERE eq.exam_id = ee.id) AS questions_count
    FROM public.electronic_exams ee
    JOIN parent_students ps ON ps.class_id = ee.class_id
    WHERE ee.status = 'published'
      AND (p_school_id IS NULL OR ee.school_id = p_school_id OR ee.school_id = ps.school_id)
    ORDER BY ee.created_at DESC
    LIMIT 50
  ),
  exams_with_attempts AS (
    SELECT 
      pe.*,
      (
        SELECT jsonb_build_object(
          'id', ea.id,
          'exam_id', ea.exam_id,
          'student_id', ea.student_id,
          'parent_id', ea.parent_id,
          'score', ea.score,
          'total_score', ea.total_score,
          'completed_at', ea.completed_at,
          'answers', ea.answers
        )
        FROM public.exam_attempts ea
        WHERE ea.exam_id = pe.id 
          AND (ea.parent_id = p_parent_id OR ea.student_id = pe.student_id)
        ORDER BY ea.completed_at DESC NULLS LAST
        LIMIT 1
      ) AS attempt
    FROM parent_exams pe
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(ewa)), '[]'::jsonb)
  INTO v_result
  FROM exams_with_attempts ewa;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_parent_electronic_exams(UUID, UUID) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. التأكد من دالة RPC لمراجعة الأسئلة مع الإجابات بعد تسليم المحاولة حصراً
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_exam_review_questions(p_exam_id UUID)
RETURNS TABLE (
  id             UUID,
  exam_id        UUID,
  school_id      UUID,
  question_type  TEXT,
  question_text  TEXT,
  options        JSONB,
  correct_answer TEXT,
  order_index    INTEGER,
  created_at     TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID := auth.uid();
  v_role         TEXT := get_auth_role();
  v_is_super     BOOLEAN := get_auth_is_super_admin();
  v_has_attempt  BOOLEAN := FALSE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'المستخدم غير مسجل الدخول';
  END IF;

  -- 1. المعلمون والإدارة والسوبر أدمن يمكنهم مراجعة الإجابات دائماً
  IF v_is_super OR v_role IN ('admin', 'teacher') THEN
    RETURN QUERY
    SELECT 
      q.id, q.exam_id, q.school_id, q.question_type, 
      q.question_text, q.options, q.correct_answer, q.order_index, q.created_at
    FROM public.exam_questions q
    WHERE q.exam_id = p_exam_id
    ORDER BY q.order_index ASC;
    RETURN;
  END IF;

  -- 2. بالنسبة لولي الأمر / الطالب: التحقق من وجود محاولة مسلمة في exam_attempts
  SELECT EXISTS (
    SELECT 1 
    FROM public.exam_attempts ea
    WHERE ea.exam_id = p_exam_id
      AND (
        ea.parent_id = v_user_id
        OR EXISTS (
          SELECT 1 FROM public.student_parents sp 
          WHERE sp.parent_id = v_user_id AND sp.student_id = ea.student_id
        )
      )
  ) INTO v_has_attempt;

  IF NOT v_has_attempt THEN
    RAISE EXCEPTION 'لا يمكنك مراجعة الإجابات النموذجية قبل إتمام وتسليم الاختبار';
  END IF;

  -- 3. إرجاع الأسئلة متضمنة correct_answer
  RETURN QUERY
  SELECT 
    q.id, q.exam_id, q.school_id, q.question_type, 
    q.question_text, q.options, q.correct_answer, q.order_index, q.created_at
  FROM public.exam_questions q
  WHERE q.exam_id = p_exam_id
  ORDER BY q.order_index ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_exam_review_questions(UUID) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. تصاريح الجداول العامة (GRANTS)
-- ─────────────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.electronic_exams TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_questions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_attempts TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_parents TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
