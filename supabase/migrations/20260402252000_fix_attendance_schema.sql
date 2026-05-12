-- ==========================================
-- Migration: 20260402252000_fix_attendance_schema
-- Goal: Add missing class_id and unique constraint for upsert
-- ==========================================

-- 1. Add class_id
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE;

-- 2. Add Unique Constraint for Upsert (on_conflict=student_id,date)
-- First, remove any potential duplicates if they exist (unlikely in this fresh DB)
DELETE FROM public.attendance a
USING public.attendance b
WHERE a.id > b.id 
  AND a.student_id = b.student_id 
  AND a.date = b.date;

ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_student_date_unique;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_student_date_unique UNIQUE (student_id, date);

-- Reload
NOTIFY pgrst, 'reload schema';
