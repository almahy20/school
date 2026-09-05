-- Migration: 20260913000000_add_grades_upsert_unique_constraint.sql
-- Goal: Ensure unique constraint / index on (student_id, exam_template_id) in public.grades
-- to support atomic PostgREST upsert (onConflict: 'student_id,exam_template_id').

DO $$
BEGIN
    -- 1. Remove any duplicate grades if they exist, keeping the latest one
    DELETE FROM public.grades a
    USING public.grades b
    WHERE a.id < b.id
      AND a.student_id = b.student_id
      AND a.exam_template_id IS NOT NULL
      AND a.exam_template_id = b.exam_template_id;

    -- 2. Add unique constraint if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'grades_student_exam_template_unique'
    ) THEN
        ALTER TABLE public.grades
        ADD CONSTRAINT grades_student_exam_template_unique UNIQUE (student_id, exam_template_id);
    END IF;
END $$;
