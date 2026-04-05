-- ==========================================
-- Migration: 20260402231500_align_schema_with_types
-- Fixes: 400 errors and broken features by aligning DB schema with frontend types
-- ==========================================

-- 1. PROFILES ALIGNMENT
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS specialization TEXT;
-- Add school_id index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_school_id ON public.profiles(school_id);

-- 2. CLASSES ALIGNMENT
-- Rename level to grade_level if needed, or add grade_level
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'level') THEN
    ALTER TABLE public.classes RENAME COLUMN level TO grade_level;
  ELSE
    ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS grade_level TEXT;
  END IF;
END $$;

-- 3. EXAM_TEMPLATES (New Table)
CREATE TABLE IF NOT EXISTS public.exam_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    exam_type TEXT NOT NULL DEFAULT 'monthly',
    max_score NUMERIC NOT NULL DEFAULT 100,
    weight NUMERIC NOT NULL DEFAULT 1,
    term TEXT NOT NULL DEFAULT 'الفصل الأول',
    title TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. GRADES ALIGNMENT
-- Add columns first
ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS exam_template_id UUID REFERENCES public.exam_templates(id) ON DELETE CASCADE;
ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS max_score NUMERIC DEFAULT 100;

-- Rename grade_value to score
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'grades' AND column_name = 'grade_value') THEN
    ALTER TABLE public.grades RENAME COLUMN grade_value TO score;
  ELSE
    ALTER TABLE public.grades ADD COLUMN IF NOT EXISTS score NUMERIC DEFAULT 0;
  END IF;
END $$;

-- 5. COMPLAINTS ALIGNMENT
-- Rename user_id to parent_id
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'complaints' AND column_name = 'user_id') THEN
    ALTER TABLE public.complaints RENAME COLUMN user_id TO parent_id;
  ELSE
    ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 6. MESSAGES ALIGNMENT
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.students(id) ON DELETE SET NULL;

-- 7. RE-NAMING FOREIGN KEYS (The 400 Error Fix)
-- This ensures PostgREST can join tables correctly based on expected names.

-- Messages
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_receiver_id_fkey;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_sender_id_fkey 
  FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_receiver_id_fkey 
  FOREIGN KEY (receiver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Classes
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_teacher_id_fkey;
ALTER TABLE public.classes
  ADD CONSTRAINT classes_teacher_id_fkey 
  FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Student-Parents
ALTER TABLE public.student_parents DROP CONSTRAINT IF EXISTS student_parents_parent_id_fkey;
ALTER TABLE public.student_parents
  ADD CONSTRAINT student_parents_parent_id_fkey 
  FOREIGN KEY (parent_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 8. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
