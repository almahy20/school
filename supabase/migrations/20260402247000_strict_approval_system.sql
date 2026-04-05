-- ==========================================
-- Migration: 20260402247000_strict_approval_system
-- Goal: Automated approval for admins and pending status for all others
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_school_id uuid;
  v_is_dev boolean;
  v_approval text;
BEGIN
  -- 1. Identify Developer (The Mahy)
  v_is_dev := (NEW.raw_user_meta_data->>'phone' = '0192837465');
  
  -- 2. Extract metadata
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  v_school_id := (NEW.raw_user_meta_data->>'school_id')::uuid;

  -- 3. Determine Approval Status
  -- Admins and Developers are AUTO-APPROVED
  -- Everyone else starts as PENDING
  IF v_is_dev OR v_role = 'admin' THEN
    v_approval := 'approved';
  ELSE
    v_approval := 'pending';
  END IF;

  -- 4. Create Profile
  INSERT INTO public.profiles (id, full_name, email, phone, school_id)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'phone', ''), 
    v_school_id
  );

  -- 5. Create User Role
  INSERT INTO public.user_roles (user_id, role, school_id, is_super_admin, approval_status)
  VALUES (
    NEW.id, 
    CASE WHEN v_is_dev THEN 'admin' ELSE v_role END, 
    v_school_id, 
    v_is_dev, 
    v_approval
  );

  RETURN NEW;
END;
$$;

-- Reload
NOTIFY pgrst, 'reload schema';
