-- Migration: 20260418000000_fix_parent_student_linking_v2
-- Goal: Fix parent-student linking using normalized phone numbers

-- 1. Ensure normalize_phone function exists
CREATE OR REPLACE FUNCTION public.normalize_phone(phone text)
RETURNS text AS $$
BEGIN
  IF phone IS NULL THEN RETURN NULL; END IF;
  RETURN regexp_replace(phone, '\D', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Sync existing students with parents by normalized phone
-- This will create links for any students whose parent_phone matches a parent's phone
INSERT INTO public.student_parents (school_id, student_id, parent_id)
SELECT DISTINCT
  s.school_id,
  s.id,
  p.id
FROM public.students s
INNER JOIN public.profiles p
  ON public.normalize_phone(p.phone) = public.normalize_phone(s.parent_phone)
INNER JOIN public.user_roles r
  ON r.user_id = p.id AND r.role = 'parent'
WHERE
  s.parent_phone IS NOT NULL
  AND s.parent_phone <> ''
  AND NOT EXISTS (
    SELECT 1 
    FROM public.student_parents sp 
    WHERE sp.student_id = s.id AND sp.parent_id = p.id
  )
ON CONFLICT (student_id, parent_id) DO NOTHING;

-- 3. Log the results
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.student_parents;
  RAISE NOTICE 'Total student-parent links after sync: %', v_count;
END;
$$;

-- 4. Ensure trigger exists for future students
CREATE OR REPLACE FUNCTION public.sync_student_parent_by_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id uuid;
  v_norm_phone text;
BEGIN
  -- Normalize the student's parent_phone
  v_norm_phone := public.normalize_phone(NEW.parent_phone);

  -- Only proceed if parent_phone is set
  IF v_norm_phone IS NULL OR v_norm_phone = '' THEN
    RETURN NEW;
  END IF;

  -- Find a parent with matching normalized phone in same school
  SELECT p.id INTO v_parent_id
  FROM public.profiles p
  INNER JOIN public.user_roles r ON r.user_id = p.id
  WHERE public.normalize_phone(p.phone) = v_norm_phone
    AND r.role = 'parent'
    AND (p.school_id = NEW.school_id OR p.school_id IS NULL)
  LIMIT 1;

  -- Create link if found
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO public.student_parents (school_id, student_id, parent_id)
    VALUES (NEW.school_id, NEW.id, v_parent_id)
    ON CONFLICT (student_id, parent_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Re-create trigger on students table
DROP TRIGGER IF EXISTS tr_sync_student_parent_by_phone ON public.students;
CREATE TRIGGER tr_sync_student_parent_by_phone
  AFTER INSERT OR UPDATE OF parent_phone ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_student_parent_by_phone();

-- 5. Also trigger when parent phone is updated
CREATE OR REPLACE FUNCTION public.sync_parent_students_by_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm_phone text;
BEGIN
  -- Only run if phone changed
  IF (TG_OP = 'UPDATE' AND OLD.phone = NEW.phone) THEN
    RETURN NEW;
  END IF;
  
  v_norm_phone := public.normalize_phone(NEW.phone);
  
  IF v_norm_phone IS NULL OR v_norm_phone = '' THEN
    RETURN NEW;
  END IF;
  
  -- Only for parents
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = NEW.id AND role = 'parent'
  ) THEN
    RETURN NEW;
  END IF;
  
  -- Link all students with matching parent_phone
  INSERT INTO public.student_parents (school_id, student_id, parent_id)
  SELECT s.school_id, s.id, NEW.id
  FROM public.students s
  WHERE public.normalize_phone(s.parent_phone) = v_norm_phone
    AND (s.school_id = NEW.school_id OR NEW.school_id IS NULL)
  ON CONFLICT (student_id, parent_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_parent_students_by_phone ON public.profiles;
CREATE TRIGGER tr_sync_parent_students_by_phone
  AFTER INSERT OR UPDATE OF phone ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_parent_students_by_phone();

NOTIFY pgrst, 'reload schema';
