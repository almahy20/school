-- ==============================================================================
-- Migration: 20261020230000_fix_exam_submission_and_review_safety.sql
-- Purpose  : حل أخطاء تسليم الاختبارات الإلكترونية والشاشة البيضاء عند مراجعة الإجابات:
--            1. تحديث submit_exam_attempt لإنشاء Profile لولي الأمر تلقائياً لمنع خطأ Foreign Key
--            2. إرجاع الأسئلة باسميها 'questions' و 'questions_with_answers' للتوافق مع الواجهة
--            3. قبول التسليم حتى لو تم إغلاق الاختبار أثناء حل الطالب
--            4. ربط الطالب بولي الأمر تلقائياً في student_parents عند تسليم الاختبار
--            5. ترقية get_exam_review_questions لدعم التحقق بالهاتف والعودة الآمنة بـ 0 صفوف
--            NOTE: هذه الدالات تعمل بنظام CREATE OR REPLACE فائق السرعة بدون قفل الجداول (Zero Lock Contentions)
-- ==============================================================================

SET search_path TO public;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. تحديث دالة submit_exam_attempt لتكون درع حماية متكامل فوري التنفيذ
-- ─────────────────────────────────────────────────────────────────────────────
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
  v_question         RECORD;
  v_score            INT := 0;
  v_total            INT := 0;
  v_given            TEXT;
  v_correct          TEXT;
  v_is_correct       BOOLEAN;
  v_questions_json   JSONB := '[]'::JSONB;
  v_question_obj     JSONB;
  v_attempt_id       UUID;
  v_school_id        UUID;
  v_effective_parent UUID := p_parent_id;
BEGIN
  -- أ) التحقق من وجود الاختبار ومعرفة المدرسة (نقبل التسليم حتى لو تم إغلاق الاختبار أثناء حل الطالب)
  SELECT school_id INTO v_school_id
  FROM public.electronic_exams
  WHERE id = p_exam_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الاختبار غير موجود';
  END IF;

  -- ب) تحديد ولي الأمر الفعلي وتأمين معرفه
  IF v_effective_parent IS NULL THEN
    v_effective_parent := auth.uid();
  END IF;

  IF v_effective_parent IS NULL THEN
    SELECT parent_id INTO v_effective_parent
    FROM public.student_parents
    WHERE student_id = p_student_id
    LIMIT 1;
  END IF;

  -- ج) تأمين وجود سجل Profile لولي الأمر لمنع خطأ Foreign Key Constraint
  IF v_effective_parent IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_effective_parent) THEN
      INSERT INTO public.profiles (id, role, school_id, full_name, created_at, updated_at)
      VALUES (v_effective_parent, 'parent', v_school_id, 'ولي أمر', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;

  -- د) ربط الطالب بولي الأمر تلقائياً في student_parents إن لم يكن مربوطاً
  IF v_effective_parent IS NOT NULL AND p_student_id IS NOT NULL THEN
    INSERT INTO public.student_parents (student_id, parent_id, school_id)
    VALUES (p_student_id, v_effective_parent, v_school_id)
    ON CONFLICT (student_id, parent_id) DO NOTHING;
  END IF;

  -- هـ) تصحيح الإجابات مع التسامح اللغوي الذكي (التاء المربوطة، الياء/الألف المقصورة، الأرقام، البدائل)
  FOR v_question IN
    SELECT 
      id, 
      question_type, 
      question_text, 
      options, 
      correct_answer, 
      order_index
    FROM public.exam_questions
    WHERE exam_id = p_exam_id
    ORDER BY order_index ASC
  LOOP
    v_total := v_total + 1;
    v_given   := COALESCE((p_answers->>(v_question.id::TEXT)), '');
    v_correct := COALESCE(v_question.correct_answer, '');

    v_is_correct := public.check_exam_answer_matches(v_given, v_correct, v_question.question_type);

    IF v_is_correct THEN
      v_score := v_score + 1;
    END IF;

    -- بناء كائن السؤال مع الإجابة النموذجية المعتمدة
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

  -- و) حفظ أو تحديث المحاولة في قاعدة البيانات (UPSERT)
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
    v_effective_parent,
    p_answers,
    v_score,
    v_total,
    p_time_spent_seconds,
    p_tab_switches_count,
    NOW()
  )
  ON CONFLICT (exam_id, student_id) DO UPDATE SET
    answers            = EXCLUDED.answers,
    score              = EXCLUDED.score,
    total_score        = EXCLUDED.total_score,
    time_spent_seconds = EXCLUDED.time_spent_seconds,
    tab_switches_count = EXCLUDED.tab_switches_count,
    completed_at       = NOW()
  RETURNING id INTO v_attempt_id;

  -- ز) إرجاع النتيجة متضمنة كلا المفتاحين للتوافق التام مع أي إصدار في الواجهة
  RETURN jsonb_build_object(
    'attempt_id',             v_attempt_id,
    'score',                  v_score,
    'total_score',            v_total,
    'questions',              v_questions_json,
    'questions_with_answers', v_questions_json
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_exam_attempt(UUID, UUID, UUID, JSONB, INT, INT)
  TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ترقية دالة get_exam_review_questions لدعم التحقق بالهاتف والعودة الآمنة
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
    RETURN;
  END IF;

  -- أ) المعلمون والإدارة والسوبر أدمن يمكنهم مراجعة الإجابات دائماً
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

  -- ب) بالنسبة لولي الأمر / الطالب: فحص وجود محاولة تخص المستخدم أو أبنائه (سواء عبر الربط المباشر أو رقم الهاتف)
  SELECT EXISTS (
    SELECT 1 
    FROM public.exam_attempts ea
    WHERE ea.exam_id = p_exam_id
      AND (
        ea.parent_id = v_user_id
        OR ea.student_id = v_user_id
        OR EXISTS (
          SELECT 1 FROM public.student_parents sp 
          WHERE sp.parent_id = v_user_id AND sp.student_id = ea.student_id
        )
        OR EXISTS (
          SELECT 1 FROM public.students s
          JOIN public.profiles p ON p.id = v_user_id
          WHERE s.id = ea.student_id
            AND (
              s.parent_phone = p.phone 
              OR s.parent_phone = p.phone_normalized
              OR right(regexp_replace(COALESCE(s.parent_phone,''), '[^0-9]', '', 'g'), 9) = 
                 right(regexp_replace(COALESCE(p.phone,''), '[^0-9]', '', 'g'), 9)
            )
        )
      )
  ) INTO v_has_attempt;

  -- إذا لم تُوجد محاولة بعد، نرجع فارغاً بهدوء بدلاً من رمي خطأ يعطل الصفحة
  IF NOT v_has_attempt THEN
    RETURN;
  END IF;

  -- ج) إرجاع الأسئلة متضمنة correct_answer
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

NOTIFY pgrst, 'reload schema';
