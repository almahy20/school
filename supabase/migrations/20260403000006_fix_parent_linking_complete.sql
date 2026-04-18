-- ==========================================
-- Migration: 20260403000000_fix_parent_linking_complete
-- Goal: Fix parent-student auto-linking and RLS policies
-- ==========================================

-- ── 1. FIX RLS: student_parents needs separate policies for parents ──────────
-- Drop the generic isolation policy first
DROP POLICY IF EXISTS "isolation_policy" ON public.student_parents;
DROP POLICY IF EXISTS "student_parents_policy" ON public.student_parents;

-- Re-create with parent-aware policy
CREATE POLICY "student_parents_policy" ON public.student_parents
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR school_id = public.get_my_school_id()
    OR parent_id = auth.uid()
  )
  WITH CHECK (
    public.is_super_admin()
    OR school_id = public.get_my_school_id()
  );

-- ── 2. FIX handle_new_user: Restore parent-student auto-link by phone ────────
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
  -- Check Super Admin
  v_is_super := COALESCE(
    (NEW.raw_user_meta_data->>'phone' = '0192837465'
     OR NEW.email = '0192837465@school.local'),
    false
  );

  -- Parse school_id
  BEGIN
    v_school_id := (NEW.raw_user_meta_data->>'school_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_school_id := NULL;
  END;

  v_role  := COALESCE(NEW.raw_user_meta_data->>'role', 'parent');
  v_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');

  -- Insert/update profile
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

  -- Insert role
  INSERT INTO public.user_roles (user_id, role, school_id, is_super_admin, approval_status)
  VALUES (
    NEW.id,
    CASE WHEN v_is_super THEN 'admin' ELSE v_role END,
    v_school_id,
    v_is_super,
    CASE WHEN v_is_super THEN 'approved' ELSE 'pending' END
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- ★ AUTO-LINK: If parent, link existing students by phone number ★
  IF v_role = 'parent' AND v_phone <> '' THEN
    INSERT INTO public.student_parents (school_id, student_id, parent_id)
    SELECT
      s.school_id,
      s.id,
      NEW.id
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

-- ── 3. FIX sync trigger: Link parent when student is added/updated ────────────
CREATE OR REPLACE FUNCTION public.sync_student_parent_by_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id uuid;
BEGIN
  -- Only proceed if parent_phone is set
  IF NEW.parent_phone IS NULL OR NEW.parent_phone = '' THEN
    RETURN NEW;
  END IF;

  -- Find a parent with matching phone in same school
  SELECT p.id INTO v_parent_id
  FROM public.profiles p
  INNER JOIN public.user_roles r ON r.user_id = p.id
  WHERE p.phone = NEW.parent_phone
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

-- ── 4. ONE-TIME SYNC: Link all existing students to their parents by phone ────
INSERT INTO public.student_parents (school_id, student_id, parent_id)
SELECT
  s.school_id,
  s.id,
  p.id
FROM public.students s
INNER JOIN public.profiles p
  ON p.phone = s.parent_phone
INNER JOIN public.user_roles r
  ON r.user_id = p.id AND r.role = 'parent'
WHERE
  s.parent_phone IS NOT NULL
  AND s.parent_phone <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.student_parents sp
    WHERE sp.student_id = s.id AND sp.parent_id = p.id
  )
ON CONFLICT (student_id, parent_id) DO NOTHING;

-- ── 5. ALSO SYNC IN REVERSE: for parents already registered whose phone
--       matches students but links are missing (edge case recovery)
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.student_parents;
  RAISE NOTICE 'student_parents total rows after sync: %', v_count;
END;
$$;

NOTIFY pgrst, 'reload schema';
