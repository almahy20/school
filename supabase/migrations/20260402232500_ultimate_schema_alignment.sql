-- ==========================================
-- Migration: 20260402232500_ultimate_schema_alignment
-- Goal: 100% Alignment with src/integrations/supabase/types.ts
-- Fixes: All 400 Bad Request errors due to schema mismatches
-- ==========================================

-- 1. SCHOOLS TABLE
-- Rename columns safely
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'subscription_plan') THEN
    ALTER TABLE public.schools RENAME COLUMN subscription_plan TO plan;
  END IF;
END $$;

ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS subscription_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.schools ALTER COLUMN slug DROP NOT NULL;

-- 2. PROFILES TABLE
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS specialization TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. STUDENTS TABLE
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'full_name') THEN
    ALTER TABLE public.students RENAME COLUMN full_name TO name;
  END IF;
END $$;

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent_phone TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 4. FEES TABLE
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fees' AND column_name = 'amount') THEN
    ALTER TABLE public.fees RENAME COLUMN amount TO amount_due;
  END IF;
END $$;

ALTER TABLE public.fees ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;
ALTER TABLE public.fees ADD COLUMN IF NOT EXISTS term TEXT DEFAULT 'الفصل الأول';
ALTER TABLE public.fees ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 5. ATTENDANCE TABLE
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 6. MESSAGES TABLE
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.students(id) ON DELETE SET NULL;

-- 7. SCHOOL_ORDERS TABLE (SaaS Management)
ALTER TABLE public.school_orders ADD COLUMN IF NOT EXISTS admin_whatsapp TEXT;
ALTER TABLE public.school_orders ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.school_orders ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
ALTER TABLE public.school_orders ADD COLUMN IF NOT EXISTS receipt_note TEXT;
ALTER TABLE public.school_orders ADD COLUMN IF NOT EXISTS rejection_note TEXT;
ALTER TABLE public.school_orders ADD COLUMN IF NOT EXISTS school_slug TEXT;
ALTER TABLE public.school_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 8. CHILDREN TABLE (Specific view for parent portal)
CREATE TABLE IF NOT EXISTS public.children (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    class_name TEXT,
    birth_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. EVALUATIONS & RECORDS (Performance Review System)
CREATE TABLE IF NOT EXISTS public.evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.evaluation_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID REFERENCES public.evaluations(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    score NUMERIC,
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. RE-ASSERT FOREIGN KEY NAMES (The 400 Error Fix)
-- Ensure PostgREST knows exactly how to join things based on the names in JS code.

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_receiver_id_fkey;
ALTER TABLE public.messages ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD CONSTRAINT messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_school_id_fkey;
ALTER TABLE public.classes ADD CONSTRAINT classes_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_school_id_fkey;
ALTER TABLE public.students ADD CONSTRAINT students_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
