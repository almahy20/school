-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Add tab_switches_count column to exam_attempts for anti-cheat tracking
-- ═══════════════════════════════════════════════════════════════════════════

-- Add the column (safe if already exists)
ALTER TABLE public.exam_attempts
  ADD COLUMN IF NOT EXISTS tab_switches_count INTEGER NOT NULL DEFAULT 0
    CHECK (tab_switches_count >= 0);

-- Add integrity_level computed column as a generated expression alternative:
-- We use a simple check column instead for simplicity
COMMENT ON COLUMN public.exam_attempts.tab_switches_count IS
  'عدد مرات مغادرة شاشة الاختبار (Tab switching / window blur) أثناء الاختبار — يُستخدم لرصد محاولات الغش';

-- Analyze table after schema change
ANALYZE public.exam_attempts;
