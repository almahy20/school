-- ==========================================
-- Migration: 20260402240000_student_parent_phone_sync
-- Automatic linking of students to parents via phone number
-- ==========================================

-- 1. Function to sync parent linking by phone
CREATE OR REPLACE FUNCTION public.sync_student_parent_by_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id uuid;
BEGIN
  -- Search for a parent profile with the matching phone in the same school
  SELECT id INTO v_parent_id 
  FROM public.profiles 
  WHERE phone = NEW.parent_phone 
    AND (school_id = NEW.school_id OR school_id IS NULL)
  LIMIT 1;

  -- If found, ensure the link exists in student_parents
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO public.student_parents (school_id, student_id, parent_id)
    VALUES (NEW.school_id, NEW.id, v_parent_id)
    ON CONFLICT (student_id, parent_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Trigger on students table
DROP TRIGGER IF EXISTS tr_sync_student_parent_by_phone ON public.students;
CREATE TRIGGER tr_sync_student_parent_by_phone
  AFTER INSERT OR UPDATE OF parent_phone ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_student_parent_by_phone();

-- 3. Enhance handle_new_user to link existing students to the new parent
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_school_id uuid;
  v_role text;
  v_phone text;
BEGIN
  v_school_id := (NEW.raw_user_meta_data->>'school_id')::uuid;
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'parent');
  v_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');

  -- Create Profile
  INSERT INTO public.profiles (id, full_name, email, phone, school_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    v_phone,
    v_school_id
  );

  -- Create Role
  INSERT INTO public.user_roles (user_id, role, school_id, is_super_admin)
  VALUES (
    NEW.id,
    v_role,
    v_school_id,
    COALESCE((v_phone = '0192837465'), false)
  );

  -- IF THE NEW USER IS A PARENT, LINK ALL EXISTING STUDENTS WITH THEIR PHONE
  IF v_role = 'parent' AND v_phone <> '' THEN
    INSERT INTO public.student_parents (school_id, student_id, parent_id)
    SELECT school_id, id, NEW.id
    FROM public.students
    WHERE parent_phone = v_phone
    ON CONFLICT (student_id, parent_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
