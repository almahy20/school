-- ==========================================
-- Migration: 20260402242000_fix_school_column_names
-- Goal: Rename subscription_plan to plan to match frontend expectations
-- ==========================================

ALTER TABLE public.schools RENAME COLUMN subscription_plan TO plan;

-- Verify RLS and RPCs still work (they use select * or named columns)
-- get_complete_user_data uses SELECT * so it will pick up the new name automatically.

NOTIFY pgrst, 'reload schema';
