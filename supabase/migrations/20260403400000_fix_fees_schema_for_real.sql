-- Migration: 20260403400000_fix_fees_schema_for_real
-- Goal: Ensure the 'fees' table matches the React frontend and fix '400 Bad Request'

-- 1. FIX FEES TABLE COLUMNS
DO $$ 
BEGIN
    -- Rename 'amount' to 'amount_due' if 'amount_due' doesn't exist but 'amount' does
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fees' AND column_name = 'amount') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fees' AND column_name = 'amount_due') THEN
        ALTER TABLE public.fees RENAME COLUMN amount TO amount_due;
    END IF;

    -- Make 'description' nullable since frontend uses 'term'
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fees' AND column_name = 'description') THEN
        ALTER TABLE public.fees ALTER COLUMN description DROP NOT NULL;
    END IF;

    -- Add missing columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fees' AND column_name = 'amount_paid') THEN
        ALTER TABLE public.fees ADD COLUMN amount_paid NUMERIC DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fees' AND column_name = 'term') THEN
        ALTER TABLE public.fees ADD COLUMN term TEXT DEFAULT 'الفصل الدراسي الأول';
    END IF;
    
    -- If 'amount' still exists after rename logic (due to previous partial migrations), make it nullable or drop it
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fees' AND column_name = 'amount') THEN
        ALTER TABLE public.fees ALTER COLUMN amount DROP NOT NULL;
    END IF;
END $$;

-- 2. FIX RLS FOR FEES (Just in case)
DROP POLICY IF EXISTS "isolation_policy" ON public.fees;
CREATE POLICY "isolation_policy" ON public.fees
    FOR ALL TO authenticated
    USING (
        public.is_super_admin()
        OR school_id = public.get_my_school_id()
    );

NOTIFY pgrst, 'reload schema';
