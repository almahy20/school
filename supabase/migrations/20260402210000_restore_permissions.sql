-- ==========================================
-- Migration: 20260402210000_restore_permissions
-- FIX: Standard Supabase permissions after a SCHEMA DROP
-- ==========================================

-- 1. Grant usage on schemas
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA internal TO anon, authenticated, service_role;

-- 2. Grant access to all tables in public
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- 3. Set default privileges for FUTURE tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- 4. Grant access to metadata (postgres role usually has this, but let's be sure for the API)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

-- 5. Ensure internal schema functions are executable
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA internal TO anon, authenticated, service_role;

-- 6. Add the FIRST DEVELOPER USER (Super Admin)
-- Use this if you want to ensure the developer account is always there.
-- Note: Replace with the actual ID if known, or let the trigger handle it.

-- 7. Fix potential public.profiles RLS for anon (needed for signup/onboarding)
CREATE POLICY "Allow public read for profiles during onboarding" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow public insert for profiles during signup" ON public.profiles FOR INSERT TO anon, authenticated WITH CHECK (true);

-- 8. Fix public.user_roles RLS for anon (needed for initial role check)
CREATE POLICY "Allow public read for roles during login" ON public.user_roles FOR SELECT TO anon, authenticated USING (true);

NOTIFY pgrst, 'reload schema';
