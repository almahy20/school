-- ==============================================================================
-- Migration: 20261018140000_secure_exam_questions_correct_answer.sql
-- Purpose  : منع الطلاب وأولياء الأمور من قراءة correct_answer من exam_questions
--            وتقييد الـ View بفصل الطالب أو أبناء ولي الأمر (student_parents)
--            وإنشاء دالة RPC لمراجعة الإجابات فقط بعد تسليم المحاولة
-- NOTE     : ملف اقتراح - لا يُطبّق إلا بعد موافقة المستخدم الصريحة
-- ==============================================================================

SET search_path TO public;

-- 1. فحص وإزالة السياسة الحالية الوحيدة (exam_questions_school_access)
DROP POLICY IF EXISTS "exam_questions_school_access" ON public.exam_questions;

-- 2. حصر الوصول المباشر لجدول exam_questions بالكامل على المعلمين والإدارة والسوبر أدمن
CREATE POLICY "exam_questions_staff_manage" ON public.exam_questions
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

-- 3. إنشاء View آمن للطلاب لا يحتوي على عمود correct_answer نهائياً
--    ومقيد بفصل الطالب أو أبناء ولي الأمر (student_parents)
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
  -- أ) السوبر أدمن
  public.get_auth_is_super_admin()
  OR (
    -- ب) المعلمون والإدارة في نفس المدرسة للاختبارات المنشورة
    q.school_id = public.get_auth_school_id() 
    AND ee.status = 'published'
    AND (
      public.get_auth_role() IN ('admin', 'teacher')
      OR
      -- ج) أولياء الأمور: يجب أن يكون الاختبار مخصصاً لفصل أحد أبنائهم في student_parents
      EXISTS (
        SELECT 1
        FROM public.student_parents sp
        JOIN public.students s ON s.id = sp.student_id
        WHERE sp.parent_id = auth.uid()
          AND s.class_id = ee.class_id
      )
    )
  );

REVOKE ALL ON public.student_exam_questions FROM public, anon;
GRANT SELECT ON public.student_exam_questions TO authenticated, service_role;

-- 4. دالة RPC آمنة لمراجعة الأسئلة مع الإجابات النموذجية بعد تسليم المحاولة حصراً
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

REVOKE ALL ON FUNCTION public.get_exam_review_questions(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_exam_review_questions(UUID) TO authenticated, service_role;

-- 5. إشعار PostgREST بتحديث الـ schema cache
NOTIFY pgrst, 'reload schema';
