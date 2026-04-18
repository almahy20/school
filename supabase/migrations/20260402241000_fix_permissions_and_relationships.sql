-- ==========================================
-- Migration: 20260402241000_fix_permissions_and_relationships
-- Goal: Restore schema/table permissions and fix foreign key naming for PostgREST joins
-- ==========================================

-- 1. SCHEMA PERMISSIONS
-- After DROP SCHEMA public CASCADE, we MUST regrant usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;

-- 2. TABLE & FUNCTION PERMISSIONS
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- 3. EXPLICIT FOREIGN KEY MARKERS (Matches frontend expectations)
-- Messages -> Profiles (Sender)
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE public.messages 
    ADD CONSTRAINT messages_sender_id_fkey 
    FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Messages -> Profiles (Receiver)
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_receiver_id_fkey;
ALTER TABLE public.messages 
    ADD CONSTRAINT messages_receiver_id_fkey 
    FOREIGN KEY (receiver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Schools (Re-verify select)
DROP POLICY IF EXISTS "anon_view_schools" ON public.schools;
CREATE POLICY "anon_view_schools" ON public.schools FOR SELECT TO anon, authenticated USING (true);

-- 4. RELOAD
NOTIFY pgrst, 'reload schema';
