-- Migration: 20260419000000_fix_parent_linking_for_phone_01008777431
-- Goal: Fix parent-student linking and enable RLS

-- ═══════════════════════════════════════════════════
-- 1. SECURITY: Enable RLS on student_parents
-- ═══════════════════════════════════════════════════

ALTER TABLE public.student_parents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_parents_policy" ON public.student_parents;
DROP POLICY IF EXISTS "isolation_policy" ON public.student_parents;
DROP POLICY IF EXISTS "student_parents_admin_policy" ON public.student_parents;
DROP POLICY IF EXISTS "student_parents_parent_view_policy" ON public.student_parents;

-- Admins can do everything
CREATE POLICY "student_parents_admin_policy" ON public.student_parents
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR 
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
      AND ur.school_id = student_parents.school_id
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR 
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'
      AND ur.school_id = student_parents.school_id
    )
  );

-- Parents can ONLY see their own links
CREATE POLICY "student_parents_parent_view_policy" ON public.student_parents
  FOR SELECT TO authenticated
  USING (parent_id = auth.uid());

-- ═══════════════════════════════════════════════════
-- 2. Fix parent-student linking for phone 01008777431
-- ═══════════════════════════════════════════════════

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
WHERE (s.parent_phone = '01008777431' 
   OR s.parent_phone = '+201008777431'
   OR s.parent_phone LIKE '%01008777431%')
  AND NOT EXISTS (
    SELECT 1 FROM public.student_parents sp
    WHERE sp.student_id = s.id AND sp.parent_id = p.id
  )
ON CONFLICT (student_id, parent_id) DO NOTHING;

-- ═══════════════════════════════════════════════════
-- 3. Fix triggers for future linking
-- ═══════════════════════════════════════════════════

-- Fix student trigger
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
  v_norm_phone := public.normalize_phone(NEW.parent_phone);

  IF v_norm_phone IS NULL OR v_norm_phone = '' THEN
    RETURN NEW;
  END IF;

  SELECT p.id INTO v_parent_id
  FROM public.profiles p
  INNER JOIN public.user_roles r ON r.user_id = p.id
  WHERE public.normalize_phone(p.phone) = v_norm_phone
    AND r.role = 'parent'
    AND (p.school_id = NEW.school_id OR p.school_id IS NULL)
  LIMIT 1;

  IF v_parent_id IS NOT NULL THEN
    INSERT INTO public.student_parents (school_id, student_id, parent_id)
    VALUES (NEW.school_id, NEW.id, v_parent_id)
    ON CONFLICT (student_id, parent_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_student_parent_by_phone ON public.students;
CREATE TRIGGER tr_sync_student_parent_by_phone
  AFTER INSERT OR UPDATE OF parent_phone ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_student_parent_by_phone();

-- Fix parent trigger
CREATE OR REPLACE FUNCTION public.sync_parent_students_by_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm_phone text;
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.phone = NEW.phone) THEN
    RETURN NEW;
  END IF;
  
  v_norm_phone := public.normalize_phone(NEW.phone);
  
  IF v_norm_phone IS NULL OR v_norm_phone = '' THEN
    RETURN NEW;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = NEW.id AND role = 'parent'
  ) THEN
    RETURN NEW;
  END IF;
  
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

-- ═══════════════════════════════════════════════════
-- 4. Sync all unmatched parents/students
-- ═══════════════════════════════════════════════════

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
WHERE s.parent_phone IS NOT NULL
  AND s.parent_phone <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.student_parents sp
    WHERE sp.student_id = s.id AND sp.parent_id = p.id
  )
ON CONFLICT (student_id, parent_id) DO NOTHING;

-- Reload schema
NOTIFY pgrst, 'reload schema';

-- 2. Ensure the trigger function uses normalize_phone
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
    
    RAISE NOTICE '✅ Auto-linked student % to parent %', NEW.id, v_parent_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Re-create the trigger
DROP TRIGGER IF EXISTS tr_sync_student_parent_by_phone ON public.students;
CREATE TRIGGER tr_sync_student_parent_by_phone
  AFTER INSERT OR UPDATE OF parent_phone ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_student_parent_by_phone();

-- 4. Also ensure parent trigger works
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
  
  RAISE NOTICE '✅ Linked parent % to matching students', NEW.id;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_parent_students_by_phone ON public.profiles;
CREATE TRIGGER tr_sync_parent_students_by_phone
  AFTER INSERT OR UPDATE OF phone ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_parent_students_by_phone();

-- 5. Final sync for all unmatched parents/students
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
WHERE s.parent_phone IS NOT NULL
  AND s.parent_phone <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.student_parents sp
    WHERE sp.student_id = s.id AND sp.parent_id = p.id
  )
ON CONFLICT (student_id, parent_id) DO NOTHING;

-- 6. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
