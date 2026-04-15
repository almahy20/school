-- Migration: 20260415000001_fix_exam_templates_rls.sql
-- Goal: Fix RLS policies for exam_templates to allow proper access

-- 1. Ensure RLS is enabled
ALTER TABLE public.exam_templates ENABLE ROW LEVEL SECURITY;

-- 2. Drop old policies if they exist
DROP POLICY IF EXISTS "isolation_policy" ON public.exam_templates;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.exam_templates;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.exam_templates;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.exam_templates;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.exam_templates;
DROP POLICY IF EXISTS "exam_templates_select_policy" ON public.exam_templates;
DROP POLICY IF EXISTS "exam_templates_insert_policy" ON public.exam_templates;
DROP POLICY IF EXISTS "exam_templates_update_policy" ON public.exam_templates;
DROP POLICY IF EXISTS "exam_templates_delete_policy" ON public.exam_templates;

-- 3. Create comprehensive policies
-- Allow SELECT for all authenticated users in the same school
CREATE POLICY "exam_templates_select_policy" 
ON public.exam_templates 
FOR SELECT 
TO authenticated 
USING (
  school_id IN (
    SELECT school_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
  OR public.is_super_admin()
);

-- Allow INSERT for authenticated users
CREATE POLICY "exam_templates_insert_policy" 
ON public.exam_templates 
FOR INSERT 
TO authenticated 
WITH CHECK (
  school_id IN (
    SELECT school_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
  OR public.is_super_admin()
);

-- Allow UPDATE for authenticated users
CREATE POLICY "exam_templates_update_policy" 
ON public.exam_templates 
FOR UPDATE 
TO authenticated 
USING (
  school_id IN (
    SELECT school_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
  OR public.is_super_admin()
);

-- Allow DELETE for authenticated users
CREATE POLICY "exam_templates_delete_policy" 
ON public.exam_templates 
FOR DELETE 
TO authenticated 
USING (
  school_id IN (
    SELECT school_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
  OR public.is_super_admin()
);

-- 4. Refresh schema cache
NOTIFY pgrst, 'reload schema';
