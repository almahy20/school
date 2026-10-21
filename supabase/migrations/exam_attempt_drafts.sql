-- ==============================================================================
-- Migration: exam_attempt_drafts.sql
-- Purpose  : حفظ تدريجي (Autosave) لإجابات الاختبار على السيرفر أثناء الحل.
--
--   المشكلة: تقدّم الاختبار كان محفوظاً في sessionStorage فقط، ولحظة إغلاق التاب
--            أو موت الجهاز تُمسح كل الإجابات ولا يبقى للسيرفر أي علم بأن الطالب بدأ.
--
--   الحل: جدول واحد به صف واحد لكل (اختبار، طالب) يُحدَّث أثناء الحل، ويُحذف عند التسليم.
--         وبما أن started_at محفوظ على السيرفر، فالوقت الحقيقي المستهلك معروف دائماً،
--         وإذا انتهى الوقت أثناء غياب الطالب يُصحَّح ما حلّه فعلاً بدل تصفيره.
--
--   ملاحظة: لا يمس هذا الجدول منطق المحاولات/التصحيح/الإعادة (exam_attempts كما هو).
--   الملف idempotent ويمكن تشغيله أكثر من مرة بأمان.
-- ==============================================================================

SET search_path TO public;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) الجدول
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exam_attempt_drafts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id                UUID NOT NULL REFERENCES public.electronic_exams(id) ON DELETE CASCADE,
  student_id             UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_id              UUID NOT NULL,
  school_id              UUID NOT NULL,
  answers                JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_question_index INT NOT NULL DEFAULT 0,
  tab_switches_count     INT NOT NULL DEFAULT 0,
  started_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- صف واحد فقط لكل طالب في كل اختبار (هو أساس الـ upsert من الواجهة)
CREATE UNIQUE INDEX IF NOT EXISTS exam_attempt_drafts_unique_attempt
  ON public.exam_attempt_drafts (exam_id, student_id);

CREATE INDEX IF NOT EXISTS exam_attempt_drafts_parent_idx
  ON public.exam_attempt_drafts (parent_id);

CREATE INDEX IF NOT EXISTS exam_attempt_drafts_student_idx
  ON public.exam_attempt_drafts (student_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2) سياسات RLS — ولي الأمر يقرأ ويكتب مسودة أبنائه فقط
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.exam_attempt_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exam_attempt_drafts_owner" ON public.exam_attempt_drafts;
CREATE POLICY "exam_attempt_drafts_owner" ON public.exam_attempt_drafts
  FOR ALL TO authenticated
  USING (parent_id = auth.uid())
  WITH CHECK (parent_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_attempt_drafts TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3) تحقق
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'exam_attempt_drafts'
  ) THEN
    RAISE NOTICE 'جدول exam_attempt_drafts جاهز';
  ELSE
    RAISE WARNING 'جدول exam_attempt_drafts غير موجود — فشل التعديل';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'exam_attempt_drafts_unique_attempt'
  ) THEN
    RAISE NOTICE 'الفهرس الفريد exam_attempt_drafts_unique_attempt جاهز';
  ELSE
    RAISE WARNING 'الفهرس الفريد exam_attempt_drafts_unique_attempt غير موجود';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exam_attempt_drafts'
      AND policyname = 'exam_attempt_drafts_owner'
  ) THEN
    RAISE NOTICE 'سياسة exam_attempt_drafts_owner جاهزة';
  ELSE
    RAISE WARNING 'سياسة exam_attempt_drafts_owner غير موجودة';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
