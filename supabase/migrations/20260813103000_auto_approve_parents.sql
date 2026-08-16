-- ════════════════════════════════════════════════════════════════════════
-- Migration: auto_approve_parents_and_clear_pending
-- Goal: Automatically approve all new parent registrations immediately
--       and update all existing pending parents to 'approved'.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Update handle_new_user to make parents 'approved' by default
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_school_id uuid;
  v_role      text;
  v_phone     text;
  v_is_super  boolean;
  v_status    text;
BEGIN
  -- Parse school_id safely
  BEGIN
    IF (NEW.raw_user_meta_data->>'school_id') IS NOT NULL 
       AND (NEW.raw_user_meta_data->>'school_id') != '' THEN
      v_school_id := (NEW.raw_user_meta_data->>'school_id')::uuid;
    ELSE
      v_school_id := NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_school_id := NULL;
  END;

  v_role  := COALESCE(NEW.raw_user_meta_data->>'role', 'parent');
  v_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');
  
  -- Check Super Admin
  v_is_super := (v_phone = '0192837465' OR NEW.email = '0192837465@school.local');

  -- Auto approve parents and super admins immediately without waiting
  IF v_is_super OR v_role = 'parent' THEN
    v_status := 'approved';
  ELSE
    v_status := 'pending';
  END IF;

  -- Insert/update profile
  BEGIN
    INSERT INTO public.profiles (id, full_name, email, phone, school_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      NEW.email,
      v_phone,
      v_school_id
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name  = EXCLUDED.full_name,
      phone      = EXCLUDED.phone,
      school_id  = COALESCE(EXCLUDED.school_id, profiles.school_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: Failed to insert profile: %', SQLERRM;
  END;

  -- Insert role
  BEGIN
    INSERT INTO public.user_roles (user_id, role, school_id, is_super_admin, approval_status)
    VALUES (
      NEW.id,
      CASE WHEN v_is_super THEN 'admin' ELSE v_role END,
      v_school_id,
      v_is_super,
      v_status
    )
    ON CONFLICT (user_id) DO UPDATE SET
      approval_status = EXCLUDED.approval_status;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: Failed to insert role: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- 2. Immediately approve all existing pending parents in the system
UPDATE public.user_roles
SET approval_status = 'approved'
WHERE role = 'parent' AND approval_status = 'pending';

NOTIFY pgrst, 'reload schema';
