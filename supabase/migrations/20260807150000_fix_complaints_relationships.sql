-- ==========================================
-- Migration: 20260807150000_fix_complaints_relationships
-- Fixes: PGRST200 error - missing FK relationship between complaints and profiles
-- ==========================================

-- 1. Ensure complaints.parent_id column is correctly typed and references profiles
-- (Some legacy migrations referenced auth.users instead of profiles, breaking joins)
DO $$
DECLARE
  rec record;
BEGIN
  -- Drop any existing FK on parent_id regardless of target (could point to auth.users or old profiles)
  FOR rec IN
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'complaints'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'parent_id'
  LOOP
    EXECUTE format('ALTER TABLE public.complaints DROP CONSTRAINT IF EXISTS %I', rec.constraint_name);
  END LOOP;
END $$;

-- 2. Explicitly create complaints_parent_id_fkey with the expected name pointing to profiles
-- This is the name the frontend expects: complaints_parent_id_fkey
ALTER TABLE public.complaints
  DROP CONSTRAINT IF EXISTS complaints_parent_id_fkey;

ALTER TABLE public.complaints
  ADD CONSTRAINT complaints_parent_id_fkey
  FOREIGN KEY (parent_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 3. Ensure complaints_student_id_fkey also exists and points correctly
ALTER TABLE public.complaints
  DROP CONSTRAINT IF EXISTS complaints_student_id_fkey;

ALTER TABLE public.complaints
  ADD CONSTRAINT complaints_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL;

-- 4. Ensure complaints_school_id_fkey exists
ALTER TABLE public.complaints
  DROP CONSTRAINT IF EXISTS complaints_school_id_fkey;

ALTER TABLE public.complaints
  ADD CONSTRAINT complaints_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;

-- 5. Force PostgREST to reload the schema cache so it sees these relationships
NOTIFY pgrst, 'reload schema';
