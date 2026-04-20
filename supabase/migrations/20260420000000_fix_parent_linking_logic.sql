-- ═══════════════════════════════════════════════════
-- FINAL FIX FOR PARENT-STUDENT LINKING
-- ═══════════════════════════════════════════════════

-- 1. Robust normalization function (Egyptian context)
CREATE OR REPLACE FUNCTION public.normalize_phone(phone text)
RETURNS text AS $$
DECLARE
  cleaned text;
BEGIN
  IF phone IS NULL THEN RETURN NULL; END IF;
  
  -- Check if starts with +20 before cleaning
  IF phone LIKE '+20%' THEN
    cleaned := '0' || regexp_replace(substring(phone from 4), '[^0-9]', '', 'g');
  ELSE
    -- Remove all non-numeric characters
    cleaned := regexp_replace(phone, '[^0-9]', '', 'g');
    
    -- If starts with 20 and length is 12 (Egyptian number without +)
    IF cleaned LIKE '20%' AND length(cleaned) = 12 THEN
      cleaned := '0' || substring(cleaned from 3);
    END IF;
  END IF;
  
  RETURN cleaned;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Improved Student Trigger: Handle both ADDING and REMOVING links
CREATE OR REPLACE FUNCTION public.sync_student_parent_by_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_norm_phone text;
  v_new_norm_phone text;
BEGIN
  v_old_norm_phone := public.normalize_phone(OLD.parent_phone);
  v_new_norm_phone := public.normalize_phone(NEW.parent_phone);

  -- 1. If phone changed or row deleted, remove the old link
  IF (TG_OP = 'DELETE') OR (TG_OP = 'UPDATE' AND v_old_norm_phone IS DISTINCT FROM v_new_norm_phone) THEN
    DELETE FROM public.student_parents 
    WHERE student_id = OLD.id 
    AND parent_id IN (
      SELECT p.id FROM public.profiles p 
      WHERE public.normalize_phone(p.phone) = v_old_norm_phone
    );
  END IF;

  -- 2. If new phone is set, add the new link
  IF (TG_OP <> 'DELETE') AND v_new_norm_phone IS NOT NULL AND v_new_norm_phone <> '' THEN
    INSERT INTO public.student_parents (school_id, student_id, parent_id)
    SELECT NEW.school_id, NEW.id, p.id
    FROM public.profiles p
    INNER JOIN public.user_roles r ON r.user_id = p.id
    WHERE public.normalize_phone(p.phone) = v_new_norm_phone
      AND r.role = 'parent'
      AND (p.school_id = NEW.school_id OR p.school_id IS NULL)
    ON CONFLICT (student_id, parent_id) DO NOTHING;
  END IF;

  IF (TG_OP = 'DELETE') THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_student_parent_by_phone ON public.students;
CREATE TRIGGER tr_sync_student_parent_by_phone
  AFTER INSERT OR UPDATE OF parent_phone OR DELETE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_student_parent_by_phone();

-- 3. Improved Parent Trigger: Handle phone changes
CREATE OR REPLACE FUNCTION public.sync_parent_students_by_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_norm_phone text;
  v_new_norm_phone text;
  v_is_parent boolean;
BEGIN
  -- Check if user is a parent
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'parent'
  ) INTO v_is_parent;

  IF NOT v_is_parent THEN
    RETURN NEW;
  END IF;

  v_old_norm_phone := public.normalize_phone(OLD.phone);
  v_new_norm_phone := public.normalize_phone(NEW.phone);

  -- 1. If phone changed, remove old links
  IF (TG_OP = 'UPDATE' AND v_old_norm_phone IS DISTINCT FROM v_new_norm_phone) THEN
    DELETE FROM public.student_parents 
    WHERE parent_id = NEW.id 
    AND student_id IN (
      SELECT s.id FROM public.students s 
      WHERE public.normalize_phone(s.parent_phone) = v_old_norm_phone
    );
  END IF;

  -- 2. If new phone is set, add new links
  IF v_new_norm_phone IS NOT NULL AND v_new_norm_phone <> '' THEN
    INSERT INTO public.student_parents (school_id, student_id, parent_id)
    SELECT s.school_id, s.id, NEW.id
    FROM public.students s
    WHERE public.normalize_phone(s.parent_phone) = v_new_norm_phone
      AND (s.school_id = NEW.school_id OR NEW.school_id IS NULL)
    ON CONFLICT (student_id, parent_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_parent_students_by_phone ON public.profiles;
CREATE TRIGGER tr_sync_parent_students_by_phone
  AFTER UPDATE OF phone ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_parent_students_by_phone();

-- 4. CRITICAL FIX: Trigger on user_roles to handle "Late Linking" (when user becomes a parent)
CREATE OR REPLACE FUNCTION public.sync_role_students_by_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
  v_norm_phone text;
BEGIN
  -- Only proceed if role is parent
  IF NEW.role <> 'parent' THEN
    RETURN NEW;
  END IF;

  -- Get phone from profile
  SELECT phone INTO v_phone FROM public.profiles WHERE id = NEW.user_id;
  v_norm_phone := public.normalize_phone(v_phone);

  IF v_norm_phone IS NOT NULL AND v_norm_phone <> '' THEN
    INSERT INTO public.student_parents (school_id, student_id, parent_id)
    SELECT s.school_id, s.id, NEW.user_id
    FROM public.students s
    WHERE public.normalize_phone(s.parent_phone) = v_norm_phone
      AND (s.school_id = NEW.school_id OR NEW.school_id IS NULL)
    ON CONFLICT (student_id, parent_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_role_students_by_phone ON public.user_roles;
CREATE TRIGGER tr_sync_role_students_by_phone
  AFTER INSERT OR UPDATE OF role ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_role_students_by_phone();

-- 5. Final Cleanup: Fix any existing broken links and re-sync all
-- Remove links where normalized phones don't match (cleans up "stale" links)
DELETE FROM public.student_parents sp
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.students s
  JOIN public.profiles p ON p.id = sp.parent_id
  WHERE s.id = sp.student_id
  AND public.normalize_phone(s.parent_phone) = public.normalize_phone(p.phone)
);

-- Re-sync all valid links to ensure everything is up to date
INSERT INTO public.student_parents (school_id, student_id, parent_id)
SELECT s.school_id, s.id, p.id
FROM public.students s
JOIN public.profiles p ON public.normalize_phone(p.phone) = public.normalize_phone(s.parent_phone)
JOIN public.user_roles r ON r.user_id = p.id
WHERE r.role = 'parent'
  AND (p.school_id = s.school_id OR p.school_id IS NULL)
ON CONFLICT (student_id, parent_id) DO NOTHING;

-- 6. Simplify handle_new_user to avoid conflicts and improve stability
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

  -- Insert role (this will trigger tr_sync_role_students_by_phone)
  BEGIN
    INSERT INTO public.user_roles (user_id, role, school_id, is_super_admin, approval_status)
    VALUES (
      NEW.id,
      CASE WHEN v_is_super THEN 'admin' ELSE v_role END,
      v_school_id,
      v_is_super,
      CASE WHEN v_is_super THEN 'approved' ELSE 'pending' END
    )
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: Failed to insert role: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
