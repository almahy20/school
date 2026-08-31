-- ==========================================================================
-- Migration: 20260831220000_exam_server_side_scoring.sql
-- Purpose  : إنشاء دالة RPC تستقبل إجابات الطالب وتصحح الاختبار
--            على السيرفر وتحفظ النتيجة في exam_attempts
--            ثم تُرجع الدرجة والأسئلة مع الإجابات الصحيحة
--            (الإجابات الصحيحة لا تُرسل أبداً للعميل قبل التسليم)
-- ==========================================================================

SET search_path TO public;

CREATE OR REPLACE FUNCTION public.submit_exam_attempt(
  p_exam_id            UUID,
  p_student_id         UUID,
  p_parent_id          UUID,
  p_answers            JSONB,
  p_time_spent_seconds INT,
  p_tab_switches_count INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_question        RECORD;
  v_score           INT := 0;
  v_total           INT := 0;
  v_given           TEXT;
  v_correct         TEXT;
  v_questions_json  JSONB := '[]'::JSONB;
  v_question_obj    JSONB;
  v_attempt_id      UUID;
  v_school_id       UUID;
BEGIN
  -- التحقق من وجود الاختبار ومعرفة المدرسة
  SELECT school_id INTO v_school_id
  FROM public.electronic_exams
  WHERE id = p_exam_id AND status = 'published';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الاختبار غير موجود أو غير منشور';
  END IF;

  -- التحقق من عدم وجود محاولة سابقة لنفس الطالب
  IF EXISTS (
    SELECT 1 FROM public.exam_attempts
    WHERE exam_id = p_exam_id AND student_id = p_student_id
  ) THEN
    RAISE EXCEPTION 'لقد قمت بتسليم هذا الاختبار مسبقاً';
  END IF;

  -- تصحيح الإجابات وبناء قائمة الأسئلة مع الإجابات الصحيحة
  FOR v_question IN
    SELECT id, question_type, question_text, options, correct_answer, order_index
    FROM public.exam_questions
    WHERE exam_id = p_exam_id
    ORDER BY order_index ASC
  LOOP
    v_total := v_total + 1;
    v_given   := lower(trim(COALESCE((p_answers->>(v_question.id::TEXT)), '')));
    v_correct := lower(trim(v_question.correct_answer));

    IF v_given = v_correct THEN
      v_score := v_score + 1;
    END IF;

    -- بناء كائن السؤال مع الإجابة الصحيحة (يُرسل فقط بعد الحفظ)
    v_question_obj := jsonb_build_object(
      'id',             v_question.id,
      'question_type',  v_question.question_type,
      'question_text',  v_question.question_text,
      'options',        v_question.options,
      'correct_answer', v_question.correct_answer,
      'order_index',    v_question.order_index
    );
    v_questions_json := v_questions_json || jsonb_build_array(v_question_obj);
  END LOOP;

  -- حفظ المحاولة في قاعدة البيانات
  INSERT INTO public.exam_attempts (
    exam_id,
    student_id,
    parent_id,
    answers,
    score,
    total_score,
    time_spent_seconds,
    tab_switches_count,
    completed_at
  ) VALUES (
    p_exam_id,
    p_student_id,
    p_parent_id,
    p_answers,
    v_score,
    v_total,
    p_time_spent_seconds,
    p_tab_switches_count,
    NOW()
  )
  RETURNING id INTO v_attempt_id;

  -- إرجاع النتيجة مع الأسئلة والإجابات الصحيحة (بعد الحفظ)
  RETURN jsonb_build_object(
    'attempt_id',           v_attempt_id,
    'score',                v_score,
    'total_score',          v_total,
    'questions_with_answers', v_questions_json
  );
END;
$$;

-- صلاحيات التنفيذ لولي الأمر فقط
GRANT EXECUTE ON FUNCTION public.submit_exam_attempt(UUID, UUID, UUID, JSONB, INT, INT)
  TO authenticated;

-- إلغاء الصلاحية من anon تأكيداً
REVOKE EXECUTE ON FUNCTION public.submit_exam_attempt(UUID, UUID, UUID, JSONB, INT, INT)
  FROM anon;
