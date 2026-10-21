-- ==============================================================================
-- Migration: allow_exam_retakes.sql
-- Purpose  : السماح للمعلم بمنح طالب بعينه محاولة إضافية لإعادة الاختبار الإلكتروني
--
-- الفكرة:
--   كل طالب لديه محاولة واحدة افتراضياً. المعلم يضغط "إضافة محاولة" ويختار الطالب،
--   فيُسجَّل صف في exam_retake_grants = محاولة إضافية واحدة لهذا الطالب تحديداً.
--   الحد المسموح للطالب = COALESCE(max_attempts, 1) + عدد المنح له.
--
-- التغييرات:
--   1. electronic_exams.max_attempts — الحد الأساسي للمحاولات (1 افتراضياً)
--   2. exam_attempts.attempt_number — رقم كل محاولة للطالب في نفس الاختبار
--   3. إزالة قيد المحاولة الواحدة UNIQUE (exam_id, student_id)
--      واستبداله بـ UNIQUE (exam_id, student_id, attempt_number)
--   4. جدول exam_retake_grants — سجل منح المحاولات الإضافية لكل طالب
--   5. دالة grant_exam_retake — منح محاولة إضافية (SECURITY DEFINER مع تحقق الصلاحية)
--   6. submit_exam_attempt — حساب رقم المحاولة + رفض ما تجاوز الحد المسموح
--   7. get_parent_electronic_exams — إرجاع الحد المسموح (أساس + منح) والمستهلك
--
-- ملاحظة: idempotent — يمكن تشغيله أكثر من مرة بأمان.
-- ==============================================================================

SET search_path TO public;

-- ── 1) الحد الأساسي للمحاولات (1 افتراضياً — يُزاد بمقدار المنح لكل طالب) ────
ALTER TABLE public.electronic_exams
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.electronic_exams
  DROP CONSTRAINT IF EXISTS electronic_exams_max_attempts_check;
ALTER TABLE public.electronic_exams
  ADD CONSTRAINT electronic_exams_max_attempts_check
  CHECK (max_attempts >= 1 AND max_attempts <= 10);

-- ── 2) رقم المحاولة ─────────────────────────────────────────────────────────
ALTER TABLE public.exam_attempts
  ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.exam_attempts
  DROP CONSTRAINT IF EXISTS exam_attempts_attempt_number_check;
ALTER TABLE public.exam_attempts
  ADD CONSTRAINT exam_attempts_attempt_number_check
  CHECK (attempt_number >= 1);

-- ── 3) فك قيد المحاولة الواحدة ──────────────────────────────────────────────
ALTER TABLE public.exam_attempts DROP CONSTRAINT IF EXISTS exam_attempts_unique_student;

CREATE UNIQUE INDEX IF NOT EXISTS exam_attempts_unique_attempt
  ON public.exam_attempts (exam_id, student_id, attempt_number);

-- فهرس مساعد لاستعلام "أحدث محاولة للطالب"
CREATE INDEX IF NOT EXISTS exam_attempts_latest_idx
  ON public.exam_attempts (exam_id, student_id, attempt_number DESC);

-- ── 4) جدول منح المحاولات الإضافية (كل صف = محاولة إضافية واحدة لطالب) ───────
CREATE TABLE IF NOT EXISTS public.exam_retake_grants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id    UUID NOT NULL REFERENCES public.electronic_exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id  UUID NOT NULL,
  granted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS exam_retake_grants_lookup_idx
  ON public.exam_retake_grants (exam_id, student_id);

ALTER TABLE public.exam_retake_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exam_retake_grants_staff_all" ON public.exam_retake_grants;
CREATE POLICY "exam_retake_grants_staff_all" ON public.exam_retake_grants
  FOR ALL TO authenticated
  USING (
    get_auth_is_super_admin()
    OR (school_id = get_auth_school_id() AND get_auth_role() IN ('admin', 'teacher'))
  )
  WITH CHECK (
    get_auth_is_super_admin()
    OR (school_id = get_auth_school_id() AND get_auth_role() IN ('admin', 'teacher'))
  );

DROP POLICY IF EXISTS "exam_retake_grants_parent_select" ON public.exam_retake_grants;
CREATE POLICY "exam_retake_grants_parent_select" ON public.exam_retake_grants
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.student_parents sp
      WHERE sp.student_id = exam_retake_grants.student_id AND sp.parent_id = auth.uid()
    )
  );

-- ── 5) دالة منح محاولة إضافية لطالب ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.grant_exam_retake(
  p_exam_id    UUID,
  p_student_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam_school UUID;
  v_school_id   UUID;
  v_role        TEXT;
  v_grants      INT;
BEGIN
  SELECT school_id INTO v_exam_school
  FROM public.electronic_exams
  WHERE id = p_exam_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الاختبار غير موجود';
  END IF;

  v_school_id := public.get_auth_school_id();
  v_role      := public.get_auth_role();

  IF NOT (
    public.get_auth_is_super_admin()
    OR (v_school_id IS NOT NULL AND v_school_id = v_exam_school AND v_role IN ('admin', 'teacher'))
  ) THEN
    RAISE EXCEPTION 'لا تملك صلاحية منح محاولة لهذا الاختبار';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = p_student_id) THEN
    RAISE EXCEPTION 'الطالب غير موجود';
  END IF;

  INSERT INTO public.exam_retake_grants (exam_id, student_id, school_id, granted_by)
  VALUES (p_exam_id, p_student_id, v_exam_school, auth.uid());

  SELECT COUNT(*)::int INTO v_grants
  FROM public.exam_retake_grants
  WHERE exam_id = p_exam_id AND student_id = p_student_id;

  RETURN jsonb_build_object(
    'exam_id',        p_exam_id,
    'student_id',     p_student_id,
    'granted_extra',  v_grants
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_exam_retake(UUID, UUID) TO authenticated;

-- ── 6) submit_exam_attempt — حصر المحاولات بالحد المسموح (أساس + منح) ────────
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
  v_max_attempts     INT := 1;
  v_granted          INT := 0;
  v_last_number      INT := 0;
  v_attempt_number   INT := 1;
BEGIN
  -- أ) التحقق من وجود الاختبار ومعرفة المدرسة والحد الأساسي للمحاولات
  -- (نقبل التسليم حتى لو تم إغلاق الاختبار أثناء حل الطالب)
  SELECT school_id, COALESCE(max_attempts, 1)
  INTO   v_school_id, v_max_attempts
  FROM   public.electronic_exams
  WHERE  id = p_exam_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الاختبار غير موجود';
  END IF;

  -- ب) إضافة المحاولات الإضافية الممنوحة لهذا الطالب تحديداً
  SELECT COUNT(*)::int INTO v_granted
  FROM public.exam_retake_grants
  WHERE exam_id = p_exam_id AND student_id = p_student_id;

  v_max_attempts := COALESCE(v_max_attempts, 1) + COALESCE(v_granted, 0);

  -- ج) تحديد ولي الأمر الفعلي وتأمين معرفه
  IF v_effective_parent IS NULL THEN
    v_effective_parent := auth.uid();
  END IF;

  IF v_effective_parent IS NULL THEN
    SELECT parent_id INTO v_effective_parent
    FROM public.student_parents
    WHERE student_id = p_student_id
    LIMIT 1;
  END IF;

  -- د) تأمين وجود سجل Profile لولي الأمر لمنع خطأ Foreign Key Constraint
  IF v_effective_parent IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_effective_parent) THEN
      INSERT INTO public.profiles (id, role, school_id, full_name, created_at, updated_at)
      VALUES (v_effective_parent, 'parent', v_school_id, 'ولي أمر', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;

  -- هـ) ربط الطالب بولي الأمر تلقائياً في student_parents إن لم يكن مربوطاً
  IF v_effective_parent IS NOT NULL AND p_student_id IS NOT NULL THEN
    INSERT INTO public.student_parents (student_id, parent_id, school_id)
    VALUES (p_student_id, v_effective_parent, v_school_id)
    ON CONFLICT (student_id, parent_id) DO NOTHING;
  END IF;

  -- و) حساب رقم المحاولة الحالية ورفض ما تجاوز الحد المسموح
  SELECT COALESCE(MAX(attempt_number), 0)
  INTO   v_last_number
  FROM   public.exam_attempts
  WHERE  exam_id = p_exam_id AND student_id = p_student_id;

  IF v_last_number >= v_max_attempts THEN
    RAISE EXCEPTION 'لقد استنفذ الطالب جميع المحاولات المسموح بها لهذا الاختبار (%)', v_max_attempts;
  END IF;

  v_attempt_number := v_last_number + 1;

  -- ز) تصحيح الإجابات مع التسامح اللغوي الذكي (التاء المربوطة، الياء/الألف المقصورة، الأرقام، البدائل)
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

  -- ح) حفظ المحاولة الجديدة (كل محاولة صف مستقل برقمها الخاص)
  INSERT INTO public.exam_attempts (
    exam_id,
    student_id,
    parent_id,
    answers,
    score,
    total_score,
    time_spent_seconds,
    tab_switches_count,
    attempt_number,
    started_at,
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
    v_attempt_number,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_attempt_id;

  -- ط) إرجاع النتيجة متضمنة كلا المفتاحين للتوافق التام مع أي إصدار في الواجهة
  RETURN jsonb_build_object(
    'attempt_id',             v_attempt_id,
    'attempt_number',         v_attempt_number,
    'max_attempts',           v_max_attempts,
    'attempts_remaining',     GREATEST(v_max_attempts - v_attempt_number, 0),
    'score',                  v_score,
    'total_score',            v_total,
    'questions',              v_questions_json,
    'questions_with_answers', v_questions_json
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_exam_attempt(UUID, UUID, UUID, JSONB, INT, INT)
  TO authenticated, service_role;

-- ── 7) get_parent_electronic_exams — الحد المسموح (أساس + منح) والمستهلك ─────
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
      COALESCE(ee.max_attempts, 1) + COALESCE((
        SELECT COUNT(*)::int FROM public.exam_retake_grants g
        WHERE g.exam_id = ee.id AND g.student_id = ps.student_id
      ), 0) AS max_attempts,
      COALESCE((
        SELECT COUNT(*)::int FROM public.exam_retake_grants g
        WHERE g.exam_id = ee.id AND g.student_id = ps.student_id
      ), 0) AS granted_attempts,
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
        SELECT COUNT(*)::int
        FROM public.exam_attempts ea
        WHERE ea.exam_id = pe.id AND ea.student_id = pe.student_id
      ) AS attempts_used,
      (
        SELECT jsonb_build_object(
          'id', ea.id,
          'exam_id', ea.exam_id,
          'student_id', ea.student_id,
          'parent_id', ea.parent_id,
          'score', ea.score,
          'total_score', ea.total_score,
          'attempt_number', ea.attempt_number,
          'time_spent_seconds', ea.time_spent_seconds,
          'tab_switches_count', ea.tab_switches_count,
          'started_at', ea.started_at,
          'completed_at', ea.completed_at,
          'answers', ea.answers
        )
        FROM public.exam_attempts ea
        WHERE ea.exam_id = pe.id
          AND (ea.student_id = pe.student_id OR ea.parent_id = p_parent_id)
        ORDER BY
          (ea.student_id = pe.student_id) DESC,
          ea.attempt_number DESC NULLS LAST,
          ea.completed_at DESC NULLS LAST
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

-- ── 8) تحقق ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'electronic_exams' AND column_name = 'max_attempts'
  ) THEN
    RAISE NOTICE 'electronic_exams.max_attempts جاهز';
  ELSE
    RAISE WARNING 'electronic_exams.max_attempts غير موجود — فشل التعديل';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'exam_attempts' AND column_name = 'attempt_number'
  ) THEN
    RAISE NOTICE 'exam_attempts.attempt_number جاهز';
  ELSE
    RAISE WARNING 'exam_attempts.attempt_number غير موجود — فشل التعديل';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'exam_retake_grants'
  ) THEN
    RAISE NOTICE 'جدول exam_retake_grants جاهز';
  ELSE
    RAISE WARNING 'جدول exam_retake_grants غير موجود — فشل التعديل';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'exam_attempts_unique_student'
  ) THEN
    RAISE WARNING 'قيد exam_attempts_unique_student لا يزال قائماً — لن تسمح قاعدة البيانات بأكثر من محاولة';
  ELSE
    RAISE NOTICE 'قيد المحاولة الواحدة أُزيل بنجاح';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
