-- ==========================================
-- Migration: 20260402420000_fix_parent_student_linking
-- FIX: Restore parent-student auto-linking that was removed by 20260402390000
-- ==========================================

-- 1. Restore handle_new_user WITH parent-student linking logic
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
  v_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');

  -- Profile
  INSERT INTO public.profiles (id, full_name, email, phone, school_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    v_phone,
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
    CASE WHEN v_is_super_admin THEN 'approved' ELSE 'pending' END
  ) ON CONFLICT (user_id) DO NOTHING;

  -- ★★★ AUTO-LINK: If new user is a parent, link existing students by phone ★★★
  IF v_role = 'parent' AND v_phone <> '' THEN
    INSERT INTO public.student_parents (school_id, student_id, parent_id)
    SELECT s.school_id, s.id, NEW.id
    FROM public.students s
    WHERE s.parent_phone = v_phone
      AND (v_school_id IS NULL OR s.school_id = v_school_id)
    ON CONFLICT (student_id, parent_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 2. Re-create sync trigger (links parent when student is added/updated)
CREATE OR REPLACE FUNCTION public.sync_student_parent_by_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id uuid;
BEGIN
  -- Only run if parent_phone is set
  IF NEW.parent_phone IS NULL OR NEW.parent_phone = '' THEN
    RETURN NEW;
  END IF;

  -- Search for a parent profile with matching phone in same school
  SELECT p.id INTO v_parent_id
  FROM public.profiles p
  INNER JOIN public.user_roles r ON r.user_id = p.id
  WHERE p.phone = NEW.parent_phone
    AND r.role = 'parent'
    AND (p.school_id = NEW.school_id OR p.school_id IS NULL)
  LIMIT 1;

  -- If found, create the link
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO public.student_parents (school_id, student_id, parent_id)
    VALUES (NEW.school_id, NEW.id, v_parent_id)
    ON CONFLICT (student_id, parent_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Re-create the trigger on students table
DROP TRIGGER IF EXISTS tr_sync_student_parent_by_phone ON public.students;
CREATE TRIGGER tr_sync_student_parent_by_phone
  AFTER INSERT OR UPDATE OF parent_phone ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_student_parent_by_phone();

-- 4. One-time sync: link any existing unlinked students to parents by phone
INSERT INTO public.student_parents (school_id, student_id, parent_id)
SELECT s.school_id, s.id, p.id
FROM public.students s
INNER JOIN public.profiles p ON p.phone = s.parent_phone
INNER JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'parent'
WHERE s.parent_phone IS NOT NULL
  AND s.parent_phone != ''
  AND NOT EXISTS (
    SELECT 1 FROM public.student_parents sp
    WHERE sp.student_id = s.id AND sp.parent_id = p.id
  )
ON CONFLICT (student_id, parent_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
