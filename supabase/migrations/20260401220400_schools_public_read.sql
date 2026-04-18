-- Migration: schools_public_read
-- Allow anonymous users to see basic school info for registration purposes.

-- 1. Ensure RLS is enabled
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies if any (we want to add a permissive one for anon)
DROP POLICY IF EXISTS "Allow anon to view basic school info" ON public.schools;

-- 3. Create a policy for anonymous and authenticated users to see basic info
CREATE POLICY "Allow anon to view basic school info" 
ON public.schools 
FOR SELECT 
TO anon, authenticated
USING (true);

-- 4. Grant column-level permissions to avoid over-exposing sensitive fields like 'plan' if needed
-- But a simple SELECT is usually enough if we trust the 'USING (true)' policy for public data.
-- Let's just make it explicit for the 'anon' role.
GRANT SELECT (id, name, logo_url, slug) ON public.schools TO anon;
GRANT SELECT ON public.schools TO authenticated;

-- Refresh schema
NOTIFY pgrst, 'reload schema';
