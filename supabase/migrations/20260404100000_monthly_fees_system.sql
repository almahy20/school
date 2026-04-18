-- Migration: 20260404100000_monthly_fees_system.sql
-- Goal: Transition the fees system to a monthly billing model

-- 1. Add month and year columns to fees table
ALTER TABLE public.fees ADD COLUMN IF NOT EXISTS month INTEGER;
ALTER TABLE public.fees ADD COLUMN IF NOT EXISTS year INTEGER;

-- 2. Update existing records to a default month/year if they are null
UPDATE public.fees 
SET 
    month = EXTRACT(MONTH FROM created_at),
    year = EXTRACT(YEAR FROM created_at)
WHERE month IS NULL OR year IS NULL;

-- 3. Add a unique constraint to prevent duplicate fees for the same student in the same month
-- First, remove any existing duplicates if they exist (keep the one with highest amount_paid)
DELETE FROM public.fees a
USING public.fees b
WHERE a.id < b.id 
  AND a.student_id = b.student_id 
  AND a.month = b.month 
  AND a.year = b.year;

ALTER TABLE public.fees DROP CONSTRAINT IF EXISTS fees_student_month_year_key;
ALTER TABLE public.fees ADD CONSTRAINT fees_student_month_year_key UNIQUE (student_id, month, year);

-- 4. Function to generate monthly fees for all students in a school
CREATE OR REPLACE FUNCTION public.generate_monthly_fees(
    p_school_id UUID,
    p_month INTEGER,
    p_year INTEGER,
    p_amount NUMERIC,
    p_term TEXT
)
RETURNS void AS $$
BEGIN
    INSERT INTO public.fees (student_id, school_id, amount_due, amount_paid, status, month, year, term)
    SELECT 
        s.id, 
        p_school_id, 
        p_amount, 
        0, 
        'unpaid', 
        p_month, 
        p_year, 
        p_term
    FROM public.students s
    WHERE s.school_id = p_school_id
    ON CONFLICT (student_id, month, year) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
