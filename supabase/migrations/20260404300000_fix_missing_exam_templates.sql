-- Migration: 20260404300000_fix_missing_exam_templates.sql
-- Goal: Restore the exam_templates table and update grades schema after a database reset

-- 1. Create exam_templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.exam_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    exam_type TEXT NOT NULL DEFAULT 'monthly',
    max_score NUMERIC NOT NULL DEFAULT 100,
    weight NUMERIC NOT NULL DEFAULT 1,
    term TEXT NOT NULL DEFAULT 'الفصل الأول',
    title TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS on exam_templates
ALTER TABLE public.exam_templates ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies for exam_templates
DROP POLICY IF EXISTS "isolation_policy" ON public.exam_templates;
CREATE POLICY "isolation_policy" ON public.exam_templates 
    FOR ALL TO authenticated 
    USING ( public.is_super_admin() OR school_id = public.get_my_school_id() );

-- 4. Update grades table structure
ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS exam_template_id UUID REFERENCES public.exam_templates(id) ON DELETE CASCADE;
ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS max_score NUMERIC DEFAULT 100;

-- 5. Ensure grades.score is TEXT (to support text-based grades)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'grades' AND column_name = 'grade_value'
    ) THEN
        ALTER TABLE public.grades RENAME COLUMN grade_value TO score;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'grades' AND column_name = 'score' AND data_type != 'text'
    ) THEN
        ALTER TABLE public.grades ALTER COLUMN score TYPE TEXT USING score::TEXT;
    END IF;
END $$;

-- 6. Add subject to exam_templates if missing from unique logic (optional but good for PostgREST)
-- (Already in table definition above)

-- 7. Refresh schema cache
NOTIFY pgrst, 'reload schema';
