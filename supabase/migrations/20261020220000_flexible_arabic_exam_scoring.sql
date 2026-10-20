-- ==============================================================================
-- Migration: 20261020220000_flexible_arabic_exam_scoring.sql
-- Purpose  : تصحيح ذكي ومرن للغة العربية في أسئلة "أكمل الفراغ" (Fill in the blank)
--            1. قبول التاء المربوطة والهاء (ة <-> ه) مثل "مدرسة" و "مدرسه"
--            2. قبول الياء والألف المقصورة (ي <-> ى) مثل "علي" و "على" أو "مصطفى" و "مصطفي"
--            3. قبول الهمزات بجميع أشكالها (أ / إ / آ / ا) مثل "أحمد" و "احمد"
--            4. قبول الأرقام باللغتين العربية والإنجليزية (٠-٩ <-> 0-9) مثل "١٩٧٣" و "1973"
--            5. إهمال التشكيل والتنوين والتطويل (ـ)
--            6. قبول الفروق الطفيفة في المسافات مثل "عبد الرحمن" و "عبدالرحمن"
--            7. دعم البدائل المتعددة المفصولة بـ / أو ، أو ,
--            8. إعادة تصحيح جميع محاولات الطلاب السابقة تلقائياً لإنصافهم
-- ==============================================================================

SET search_path TO public;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. دالة توحيد وتطبيع النص العربي للإجابات
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.normalize_arabic_answer(p_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_res TEXT;
BEGIN
  IF p_text IS NULL THEN
    RETURN '';
  END IF;

  v_res := trim(lower(p_text));

  -- 0. تحويل الأرقام العربية/المشرقية والفارسية إلى أرقام موحدة (٠-٩ و ۰-۹ -> 0-9)
  v_res := translate(v_res, '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789');

  -- 1. إزالة التشكيل (الحركات والتنوين) والتطويل (ـ)
  v_res := regexp_replace(v_res, '[\u064B-\u065F\u0670\u0640]', '', 'g');

  -- 2. إزالة الأحرف غير المرئية
  v_res := regexp_replace(v_res, '[\u200B-\u200D\uFEFF]', '', 'g');

  -- 3. توحيد الهمزات والألف (أ, إ, آ, ٱ, ء -> ا)
  v_res := regexp_replace(v_res, '[أإآٱء]', 'ا', 'g');

  -- 4. توحيد الياء والألف المقصورة والنبرة (ى, ئ, ی -> ي)
  v_res := regexp_replace(v_res, '[ىئ\u06CC]', 'ي', 'g');

  -- 5. توحيد التاء المربوطة والهاء (ة -> ه)
  v_res := regexp_replace(v_res, 'ة', 'ه', 'g');

  -- 6. توحيد الواو المهموزة (ؤ -> و)
  v_res := regexp_replace(v_res, 'ؤ', 'و', 'g');

  -- 7. توحيد الكاف الفارسية (ک -> ك)
  v_res := regexp_replace(v_res, '\u06A9', 'ك', 'g');

  -- 8. تقليص المسافات المتعددة لمسافة واحدة
  v_res := regexp_replace(v_res, '\s+', ' ', 'g');

  RETURN trim(v_res);
END;
$$;

GRANT EXECUTE ON FUNCTION public.normalize_arabic_answer(TEXT) TO authenticated, service_role, anon;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. دالة فحص ومطابقة إجابة الطالب مع الإجابة النموذجية
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_exam_answer_matches(
  p_given   TEXT,
  p_correct TEXT,
  p_qtype   TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_norm_given   TEXT;
  v_norm_correct TEXT;
  v_alt          TEXT;
BEGIN
  IF p_given IS NULL OR trim(p_given) = '' THEN
    RETURN FALSE;
  END IF;
  IF p_correct IS NULL OR trim(p_correct) = '' THEN
    RETURN FALSE;
  END IF;

  -- أ) أسئلة الاختيار من متعدد وصح أو خطأ: مطابقة مباشرة بدون حساسية لحالة الأحرف أو شكل الأرقام
  IF p_qtype IN ('multiple_choice', 'true_false') THEN
    RETURN translate(lower(trim(p_given)), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789') = 
           translate(lower(trim(p_correct)), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789');
  END IF;

  -- ب) أسئلة أكمل الفراغ (fill_blank): تسامح لغوي عربي كامل
  v_norm_given   := public.normalize_arabic_answer(p_given);
  v_norm_correct := public.normalize_arabic_answer(p_correct);

  -- تطابق مباشر بعد التوحيد
  IF v_norm_given = v_norm_correct THEN
    RETURN TRUE;
  END IF;

  -- تطابق بدون مسافات (لحالات الأسماء المركبة مثل "عبد الرحمن" مقابل "عبدالرحمن")
  IF replace(v_norm_given, ' ', '') = replace(v_norm_correct, ' ', '') THEN
    RETURN TRUE;
  END IF;

  -- ج) فحص البدائل المتعددة إذا وضع المعلم إجابات بديلة مفصولة بـ / أو ، أو ,
  IF p_correct ~ '[/,،]' THEN
    FOREACH v_alt IN ARRAY regexp_split_to_array(p_correct, '\s*[/,،]\s*')
    LOOP
      IF trim(v_alt) <> '' THEN
        IF v_norm_given = public.normalize_arabic_answer(v_alt)
           OR replace(v_norm_given, ' ', '') = replace(public.normalize_arabic_answer(v_alt), ' ', '') THEN
          RETURN TRUE;
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_exam_answer_matches(TEXT, TEXT, TEXT) TO authenticated, service_role, anon;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. تحديث دالة submit_exam_attempt لاستخدام التصحيح الذكي
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
  v_question        RECORD;
  v_score           INT := 0;
  v_total           INT := 0;
  v_given           TEXT;
  v_correct         TEXT;
  v_is_correct      BOOLEAN;
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

  -- تصحيح الإجابات وبناء قائمة الأسئلة مع الإجابات الصحيحة
  FOR v_question IN
    SELECT id, question_type, question_text, options, correct_answer, order_index
    FROM public.exam_questions
    WHERE exam_id = p_exam_id
    ORDER BY order_index ASC
  LOOP
    v_total := v_total + 1;
    v_given   := COALESCE((p_answers->>(v_question.id::TEXT)), '');
    v_correct := COALESCE(v_question.correct_answer, '');

    -- استخدام دالة المطابقة الذكية للغة العربية والبدائل
    v_is_correct := public.check_exam_answer_matches(v_given, v_correct, v_question.question_type);

    IF v_is_correct THEN
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

  -- حفظ أو تحديث المحاولة في قاعدة البيانات بسلاسة (UPSERT)
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
  ON CONFLICT (exam_id, student_id) DO UPDATE SET
    answers            = EXCLUDED.answers,
    score              = EXCLUDED.score,
    total_score        = EXCLUDED.total_score,
    time_spent_seconds = EXCLUDED.time_spent_seconds,
    tab_switches_count = EXCLUDED.tab_switches_count,
    completed_at       = NOW()
  RETURNING id INTO v_attempt_id;

  -- إرجاع النتيجة مع الأسئلة والإجابات الصحيحة
  RETURN jsonb_build_object(
    'attempt_id',             v_attempt_id,
    'score',                  v_score,
    'total_score',            v_total,
    'questions_with_answers', v_questions_json
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_exam_attempt(UUID, UUID, UUID, JSONB, INT, INT)
  TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. تحديث دالة recalculate_exam_scores لإعادة تصحيح الاختبارات السابقة بذكاء
-- ─────────────────────────────────────────────────────────────────────────────
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

    -- 3. مطابقة إجابة كل طالب المخزنة مع الإجابات النموذجية باستخدام التصحيح الذكي
    FOR v_question IN
      SELECT id, correct_answer, question_type
      FROM public.exam_questions
      WHERE exam_id = p_exam_id
    LOOP
      v_given   := COALESCE((v_attempt.answers->>(v_question.id::TEXT)), '');
      v_correct := COALESCE(v_question.correct_answer, '');

      IF public.check_exam_answer_matches(v_given, v_correct, v_question.question_type) THEN
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
    'exam_id',          p_exam_id,
    'total_questions',  v_total,
    'attempts_updated', v_updated_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_exam_scores(UUID) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. إعادة تصحيح جميع محاولات الاختبارات الحالية في النظام لإنصاف الطلاب فوراً
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.electronic_exams LOOP
    PERFORM public.recalculate_exam_scores(r.id);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
