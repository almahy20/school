-- ==========================================================================
-- Migration: 20260831233000_recalculate_exam_scores.sql
-- Purpose  : إعادة تصحيح وحساب درجات جميع الطلاب لاختبار معين تلقائياً
--            عند قيام المدير/المعلم بتعديل الإجابة الصحيحة لأي سؤال
-- ==========================================================================

SET search_path TO public;

CREATE OR REPLACE FUNCTION public.recalculate_exam_scores(p_exam_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt        RECORD;
  v_question       RECORD;
  v_score          INT;
  v_total          INT;
  v_given          TEXT;
  v_correct        TEXT;
  v_updated_count  INT := 0;
BEGIN
  -- 1. حساب إجمالي عدد الأسئلة الحالي في الاختبار
  SELECT COUNT(*) INTO v_total
  FROM public.exam_questions
  WHERE exam_id = p_exam_id;

  -- 2. المرور على جميع محاولات الطلاب السابقة لهذا الاختبار
  FOR v_attempt IN
    SELECT id, answers
    FROM public.exam_attempts
    WHERE exam_id = p_exam_id
  LOOP
    v_score := 0;

    -- 3. مطابقة إجابة كل طالب المخزنة مع الإجابات النموذجية الجديدة
    FOR v_question IN
      SELECT id, correct_answer
      FROM public.exam_questions
      WHERE exam_id = p_exam_id
    LOOP
      v_given   := lower(trim(COALESCE((v_attempt.answers->>(v_question.id::TEXT)), '')));
      v_correct := lower(trim(COALESCE(v_question.correct_answer, '')));

      -- إذا كانت إجابة الطالب مطابقة للإجابة النموذجية المحدثة تُحسب درجة صحيحة
      IF v_given <> '' AND v_given = v_correct THEN
        v_score := v_score + 1;
      END IF;
    END LOOP;

    -- 4. تحديث درجة المحاولة تلقائياً بالدرجة المصححة الجديدة
    UPDATE public.exam_attempts
    SET
      score       = v_score,
      total_score = v_total
    WHERE id = v_attempt.id;

    v_updated_count := v_updated_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success',          true,
    'exam_id',          p_exam_id,
    'total_questions',  v_total,
    'attempts_updated', v_updated_count
  );
END;
$$;

-- منح الصلاحيات للمستخدمين المسجلين (المعلم / المدير)
GRANT EXECUTE ON FUNCTION public.recalculate_exam_scores(UUID) TO authenticated;
