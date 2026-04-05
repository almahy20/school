-- ==========================================
-- Migration: 20260403000000_dynamic_curriculum_system
-- Goal: Implement a dynamic curriculum system
-- ==========================================

-- 1. Create Curriculums Table
CREATE TABLE public.curriculums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Curriculum Subjects Table
CREATE TABLE public.curriculum_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_id UUID NOT NULL REFERENCES public.curriculums(id) ON DELETE CASCADE,
    subject_name TEXT NOT NULL,
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Alter Classes Table to add curriculum_id
ALTER TABLE public.classes
ADD COLUMN curriculum_id UUID REFERENCES public.curriculums(id) ON DELETE SET NULL;

-- 4. Enable RLS for new tables
ALTER TABLE public.curriculums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_subjects ENABLE ROW LEVEL SECURITY;

-- 5. Add RLS Policies for Curriculums
CREATE POLICY "curriculums_access" ON public.curriculums FOR ALL TO authenticated USING (
    public.is_super_admin() OR school_id = public.get_my_school_id()
);

-- 6. Add RLS Policies for Curriculum Subjects
CREATE POLICY "curriculum_subjects_access" ON public.curriculum_subjects FOR ALL TO authenticated USING (
    public.is_super_admin() OR EXISTS (
        SELECT 1 FROM public.curriculums
        WHERE id = curriculum_id AND school_id = public.get_my_school_id()
    )
);

-- 7. Update RLS Policy for Classes to include curriculum_id
-- This policy already exists, so we just need to ensure it covers the new column.
-- The existing "isolation_policy" should cover this as it's based on school_id.
-- No explicit change needed here unless the existing policy is too restrictive.

-- 8. Refresh schema cache
NOTIFY pgrst, 'reload schema';
