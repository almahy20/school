-- ==========================================
-- Migration: 20260403500000_school_branding_and_teachers
-- Description: Add logo_url, icon_url, theme_color, teacher_id and teachers view
-- ==========================================

-- 1. Add branding columns to schools
ALTER TABLE public.schools 
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS icon_url TEXT,
ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT '#1A3C8F';

-- 2. Add teacher_id to students
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Create teachers view for easy querying
-- The requirements specified using: .select('id, name, teacher:teachers(name)')
CREATE OR REPLACE VIEW public.teachers AS
SELECT 
    p.id, 
    p.full_name as name, 
    p.email,
    p.phone, 
    p.school_id, 
    p.created_at
FROM public.profiles p
JOIN public.user_roles u ON p.id = u.user_id
WHERE u.role = 'teacher';

-- Grant access to authenticated users
GRANT SELECT ON public.teachers TO authenticated;

-- 4. Storage Bucket for Branding Assets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('school_assets', 'school_assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
-- Allow anyone to read
CREATE POLICY "Public Read Access" 
ON storage.objects FOR SELECT 
TO public 
USING ( bucket_id = 'school_assets' );

-- Allow authenticated users to upload (Admin/SuperAdmin usually perform this)
CREATE POLICY "Authenticated Upload Access" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK ( bucket_id = 'school_assets' );

-- Allow authenticated users to update/delete
CREATE POLICY "Authenticated Update Access"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'school_assets' );

CREATE POLICY "Authenticated Delete Access"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'school_assets' );

-- Reload schema for PostgREST
NOTIFY pgrst, 'reload schema';
