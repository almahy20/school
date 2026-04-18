-- ==========================================
-- Migration: 20260402245000_add_missing_school_logo
-- Goal: Restore the logo_url column which was missing after the reset
-- ==========================================

ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Reload
NOTIFY pgrst, 'reload schema';
