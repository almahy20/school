-- FIX: Add missing columns and unique constraint to attendance
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Ensure all existing rows have a class_id if possible (or just add the constraint)
-- For a clean slate, this will work.
ALTER TABLE public.attendance 
ADD CONSTRAINT attendance_student_id_date_unique UNIQUE (student_id, date);
