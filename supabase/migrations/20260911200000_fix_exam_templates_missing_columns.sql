-- ==========================================================================
-- Migration: 20260911200000_fix_exam_templates_missing_columns.sql
-- Purpose  : ضمان وجود كل الأعمدة المطلوبة في exam_templates
--            الجدول في production قد يفتقر لأعمدة أضيفت في migrations لاحقة
-- ==========================================================================

SET search_path TO public;

-- كل الأعمدة الأساسية التي قد تكون مفقودة
ALTER TABLE public.exam_templates
  ADD COLUMN IF NOT EXISTS title            TEXT,
  ADD COLUMN IF NOT EXISTS exam_type        TEXT,
  ADD COLUMN IF NOT EXISTS max_score        NUMERIC        DEFAULT 100,
  ADD COLUMN IF NOT EXISTS weight           NUMERIC        DEFAULT 1,
  ADD COLUMN IF NOT EXISTS term             TEXT,
  ADD COLUMN IF NOT EXISTS teacher_id       UUID,
  ADD COLUMN IF NOT EXISTS score_type       TEXT           DEFAULT 'numeric',
  ADD COLUMN IF NOT EXISTS expected_results TEXT[]         DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ    DEFAULT NOW();

-- تأكد من الـ check constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'exam_templates_score_type_check'
      AND constraint_schema = 'public'
  ) THEN
    ALTER TABLE public.exam_templates
      ADD CONSTRAINT exam_templates_score_type_check
      CHECK (score_type IN ('numeric', 'letter', 'percentage', 'text'));
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
