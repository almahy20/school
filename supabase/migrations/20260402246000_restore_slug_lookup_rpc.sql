-- ==========================================
-- Migration: 20260402246000_restore_slug_lookup_rpc
-- Goal: Restore the get_school_id_by_slug function for registration pages
-- ==========================================

CREATE OR REPLACE FUNCTION public.get_school_id_by_slug(p_slug text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT id FROM public.schools WHERE slug = p_slug LIMIT 1;
$$;

-- Grant access to everyone (necessary for signup pages)
GRANT EXECUTE ON FUNCTION public.get_school_id_by_slug TO anon, authenticated, service_role;

-- Also ensure schools table is readable by anon for basic info (logo, name)
DROP POLICY IF EXISTS "anon_read_schools_basic" ON public.schools;
CREATE POLICY "anon_read_schools_basic" ON public.schools 
    FOR SELECT TO anon 
    USING (true);

-- Reload
NOTIFY pgrst, 'reload schema';
