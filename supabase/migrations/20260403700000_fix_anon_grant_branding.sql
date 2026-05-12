-- Migration: fix_anon_grant_branding
-- Update public permissions for school branding columns

GRANT SELECT (id, name, logo_url, icon_url, theme_color, slug) ON public.schools TO anon;
GRANT SELECT ON public.schools TO authenticated;

-- Refresh schema
NOTIFY pgrst, 'reload schema';
