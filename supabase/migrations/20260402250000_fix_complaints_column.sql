-- ==========================================
-- Migration: 20260402250000_fix_complaints_column
-- Goal: Rename user_id to parent_id in complaints to match frontend
-- ==========================================

ALTER TABLE public.complaints RENAME COLUMN user_id TO parent_id;

-- Reload
NOTIFY pgrst, 'reload schema';
