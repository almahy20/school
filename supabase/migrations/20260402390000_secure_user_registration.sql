-- Fix: Default new users to pending and add robust activation RPC
-- Migration: 20260402390000_secure_user_registration

-- 1. Update handle_new_user trigger to default to 'pending'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_school_id uuid;
  v_role text;
  v_is_super_admin boolean;
BEGIN
  -- Check if developer user (Super Admin)
  v_is_super_admin := COALESCE((NEW.raw_user_meta_data->>'phone' = '0192837465' OR NEW.email = '0192837465@school.local'), false);

  -- Handle school_id
  IF (NEW.raw_user_meta_data->>'school_id') IS NOT NULL AND (NEW.raw_user_meta_data->>'school_id') != '' THEN
    v_school_id := (NEW.raw_user_meta_data->>'school_id')::uuid;
  ELSE
    v_school_id := NULL;
  END IF;

  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'parent');

  -- Profile
  INSERT INTO public.profiles (id, full_name, email, phone, school_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    v_school_id
  ) ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    school_id = COALESCE(EXCLUDED.school_id, profiles.school_id);

  -- Role
  INSERT INTO public.user_roles (user_id, role, school_id, is_super_admin, approval_status)
  VALUES (
    NEW.id,
    v_role,
    v_school_id,
    v_is_super_admin,
    CASE WHEN v_is_super_admin THEN 'approved' ELSE 'pending' END -- Default new users to pending
  ) ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2. Add robust activation RPC
-- This function will be called by Super Admin to "Force/Upgrade" a user to Admin
CREATE OR REPLACE FUNCTION public.activate_school_admin(
  p_user_id uuid,
  p_school_id uuid,
  p_full_name text,
  p_phone text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if the caller is a Super Admin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND is_super_admin = true) THEN
    RAISE EXCEPTION 'Only Super Admins can activate schools';
  END IF;

  -- 1. Ensure Profile is updated
  UPDATE public.profiles
  SET 
    full_name = p_full_name,
    phone = p_phone,
    school_id = p_school_id
  WHERE id = p_user_id;

  -- 2. Force/Upgrade User Role to Admin for this school
  INSERT INTO public.user_roles (user_id, role, school_id, is_super_admin, approval_status)
  VALUES (p_user_id, 'admin', p_school_id, false, 'approved')
  ON CONFLICT (user_id) DO UPDATE SET
    role = 'admin',
    school_id = p_school_id,
    approval_status = 'approved',
    is_super_admin = false;

END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_school_admin TO authenticated;

NOTIFY pgrst, 'reload schema';
