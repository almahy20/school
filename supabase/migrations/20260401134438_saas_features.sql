-- Migration: saas_features
-- Add slug and subscription details to schools, and approval_status to user_roles.

-- 1. Update schools table
ALTER TABLE public.schools 
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'monthly' CHECK (plan IN ('monthly', 'half_yearly', 'yearly')),
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + interval '30 days');

-- Populate slug for existing schools with a random value to avoid nulls if we make it required later
UPDATE public.schools SET slug = 'school-' || substr(id::text, 1, 8) WHERE slug IS NULL;

-- 2. Update user_roles table for approval flow
ALTER TABLE public.user_roles
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- Update existing admins and dev to be approved by default
UPDATE public.user_roles SET approval_status = 'approved' WHERE role = 'admin' OR is_super_admin = true;

-- Update existing parents/teachers to be approved so they don't get locked out initially
UPDATE public.user_roles SET approval_status = 'approved' WHERE approval_status = 'pending';


-- 3. Create helper function to get school UUID from slug securely
CREATE OR REPLACE FUNCTION public.get_school_id_by_slug(p_slug TEXT)
RETURNS UUID AS $$
DECLARE
    v_school_id UUID;
BEGIN
    SELECT id INTO v_school_id FROM public.schools WHERE slug = p_slug LIMIT 1;
    RETURN v_school_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.get_school_id_by_slug(TEXT) TO anon, authenticated;

-- Notify pgrst
NOTIFY pgrst, 'reload schema';
