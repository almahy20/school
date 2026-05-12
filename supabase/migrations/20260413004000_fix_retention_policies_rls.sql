-- Migration: fix_retention_policies_rls
-- Goal: Fix RLS for data_retention_policies to handle is_super_admin flag correctly

-- 1. Correct the SELECT policy
DROP POLICY IF EXISTS "Admins can view retention policies" ON public.data_retention_policies;
CREATE POLICY "Admins can view retention policies" 
ON public.data_retention_policies FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND (role = 'admin' OR is_super_admin = true)
    )
);

-- 2. Correct the UPDATE policy
DROP POLICY IF EXISTS "Admins can update retention policies" ON public.data_retention_policies;
CREATE POLICY "Admins can update retention policies" 
ON public.data_retention_policies FOR UPDATE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND (role = 'admin' OR is_super_admin = true)
    )
);

-- 3. Ensure permissions are granted
GRANT SELECT, UPDATE ON public.data_retention_policies TO authenticated;

-- 4. Reload schema cache
NOTIFY pgrst, 'reload schema';
