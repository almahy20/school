-- Migration: add_monthly_fee_to_students
-- Description: Add a fixed monthly fee column to students table to serve as a constant financial requirement

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC DEFAULT 0;

-- Optional: Populate monthly_fee from existing fees if applicable
-- This helps transition existing data to the new system
UPDATE public.students s
SET monthly_fee = (
    SELECT f.amount_due 
    FROM public.fees f 
    WHERE f.student_id = s.id 
    ORDER BY f.created_at DESC 
    LIMIT 1
)
WHERE s.monthly_fee = 0 OR s.monthly_fee IS NULL;

NOTIFY pgrst, 'reload schema';
