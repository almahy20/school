-- Migration: 20260819130000_add_term_to_curriculum_subjects
-- Goal: Add term column to curriculum_subjects to group by month

ALTER TABLE public.curriculum_subjects
ADD COLUMN term TEXT;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
