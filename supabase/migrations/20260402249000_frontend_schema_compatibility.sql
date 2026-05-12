-- ==========================================
-- Migration: 20260402249000_frontend_schema_compatibility
-- Goal: Align database columns with React frontend expectations
-- ==========================================

-- 1. FIX GRADES TABLE
ALTER TABLE public.grades RENAME COLUMN grade_value TO score;
ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS max_score NUMERIC DEFAULT 100;
ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;

-- 2. FIX FEES TABLE
ALTER TABLE public.fees ADD COLUMN IF NOT EXISTS amount_due NUMERIC DEFAULT 0;
ALTER TABLE public.fees ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;

-- 3. ENSURE CONSTRAINTS FOR JOINS
-- ParentChildDetailPage.tsx line 33: .select('*, classes!students_class_id_fkey(name)')
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_class_id_fkey;
ALTER TABLE public.students 
    ADD CONSTRAINT students_class_id_fkey 
    FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL;

-- 4. RELOAD
NOTIFY pgrst, 'reload schema';
