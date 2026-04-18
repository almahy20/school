-- Migration: 20260404200000_update_grades_to_text.sql
-- Goal: Allow text-based grades and ensure admins can manage all grades

-- 1. Change grades.score from NUMERIC to TEXT
-- We use a temporary column to safely cast and then rename
DO $$ 
BEGIN
    -- Only if it's not already text
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'grades' AND column_name = 'score' AND data_type != 'text'
    ) THEN
        ALTER TABLE public.grades ALTER COLUMN score TYPE TEXT USING score::TEXT;
    END IF;
END $$;

-- 2. Ensure RLS allows admins to manage everything in their school
-- FIX: Use direct query instead of get_auth_school_id() which may not exist
DROP POLICY IF EXISTS "Admins can manage all grades in their school" ON public.grades;
CREATE POLICY "Admins can manage all grades in their school" ON public.grades
    FOR ALL TO authenticated
    USING (
        public.is_super_admin()
        OR school_id = (
            SELECT school_id FROM public.profiles 
            WHERE id = auth.uid() 
            LIMIT 1
        )
    )
    WITH CHECK (
        public.is_super_admin()
        OR school_id = (
            SELECT school_id FROM public.profiles 
            WHERE id = auth.uid() 
            LIMIT 1
        )
    );

DROP POLICY IF EXISTS "Admins can manage all exam templates" ON public.exam_templates;
CREATE POLICY "Admins can manage all exam templates" ON public.exam_templates
    FOR ALL TO authenticated
    USING (
        public.is_super_admin()
        OR school_id = (
            SELECT school_id FROM public.profiles 
            WHERE id = auth.uid() 
            LIMIT 1
        )
    )
    WITH CHECK (
        public.is_super_admin()
        OR school_id = (
            SELECT school_id FROM public.profiles 
            WHERE id = auth.uid() 
            LIMIT 1
        )
    );

NOTIFY pgrst, 'reload schema';
