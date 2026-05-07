-- Migration: 20260403100000_ultimate_parent_student_fix
-- Goal: Ensure robust parent-student linking using normalized phone numbers and update RLS for privacy

-- 1. Create Normalization Function
CREATE OR REPLACE FUNCTION public.normalize_phone(phone text)
RETURNS text AS $$
BEGIN
  RETURN regexp_replace(phone, '\D', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Update Students Table: Normalize all existing parent_phone values
UPDATE public.students 
SET parent_phone = public.normalize_phone(parent_phone) 
WHERE parent_phone IS NOT NULL AND parent_phone <> '';

-- 3. Update sync_student_parent_by_phone trigger function
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

  -- Find a parent with matching normalized phone in same school (or school is null)
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

-- 4. Update handle_new_user trigger function
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
  v_norm_phone text;
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
  v_norm_phone := public.normalize_phone(v_phone);

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

  -- ★ AUTO-LINK: If parent, link existing students by normalized phone number ★
  IF v_role = 'parent' AND v_norm_phone <> '' THEN
    INSERT INTO public.student_parents (school_id, student_id, parent_id)
    SELECT
      s.school_id,
      s.id,
      NEW.id
    FROM public.students s
    WHERE public.normalize_phone(s.parent_phone) = v_norm_phone
      AND (v_school_id IS NULL OR s.school_id = v_school_id)
    ON CONFLICT (student_id, parent_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 5. Fix RLS for Privacy: Parents only see their children's data
-- Tables to fix: students, grades, attendance, fees, fee_payments

-- Students
DROP POLICY IF EXISTS "isolation_policy" ON public.students;
DROP POLICY IF EXISTS "students_isolation_policy" ON public.students;
CREATE POLICY "students_isolation_policy" ON public.students
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR school_id = public.get_my_school_id()
    OR EXISTS (
      SELECT 1 FROM public.student_parents sp
      WHERE sp.student_id = public.students.id
      AND sp.parent_id = auth.uid()
    )
  );

-- Grades
DROP POLICY IF EXISTS "isolation_policy" ON public.grades;
CREATE POLICY "grades_isolation_policy" ON public.grades
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR school_id = public.get_my_school_id()
    OR EXISTS (
      SELECT 1 FROM public.student_parents sp
      WHERE sp.student_id = public.grades.student_id
      AND sp.parent_id = auth.uid()
    )
  );

-- Attendance
DROP POLICY IF EXISTS "isolation_policy" ON public.attendance;
CREATE POLICY "attendance_isolation_policy" ON public.attendance
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR school_id = public.get_my_school_id()
    OR EXISTS (
      SELECT 1 FROM public.student_parents sp
      WHERE sp.student_id = public.attendance.student_id
      AND sp.parent_id = auth.uid()
    )
  );

-- Fees
DROP POLICY IF EXISTS "isolation_policy" ON public.fees;
CREATE POLICY "fees_isolation_policy" ON public.fees
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR school_id = public.get_my_school_id()
    OR EXISTS (
      SELECT 1 FROM public.student_parents sp
      WHERE sp.student_id = public.fees.student_id
      AND sp.parent_id = auth.uid()
    )
  );

-- Fee Payments
DROP POLICY IF EXISTS "isolation_policy" ON public.fee_payments;
CREATE POLICY "fee_payments_isolation_policy" ON public.fee_payments
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR school_id = public.get_my_school_id()
    OR EXISTS (
      SELECT 1 FROM public.student_parents sp
      JOIN public.fees f ON f.id = public.fee_payments.fee_id
      WHERE sp.student_id = f.student_id
      AND sp.parent_id = auth.uid()
    )
  );

-- 6. Re-run Sync for all existing students
INSERT INTO public.student_parents (school_id, student_id, parent_id)
SELECT
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
ON CONFLICT (student_id, parent_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
