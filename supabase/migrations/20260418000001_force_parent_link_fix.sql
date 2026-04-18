-- ═══════════════════════════════════════════════════
-- FORCE FIX - إصلاح قوي لربط الأبناء
-- ═══════════════════════════════════════════════════

-- 1. تأكد إن function normalize_phone موجود (إصلاح نهائي)
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

-- 2. اختبار الـ function الجديد
SELECT 
  normalize_phone('01005321773') as test1,
  normalize_phone('+201005321773') as test2,
  normalize_phone('201005321773') as test3;

-- 3. عرض جميع الأرقام عشان نشوف الفرق
SELECT 
  'PARENTS PHONES' as type,
  p.id,
  p.full_name,
  p.phone as original_phone,
  normalize_phone(p.phone) as normalized,
  r.approval_status
FROM profiles p
INNER JOIN user_roles r ON r.user_id = p.id AND r.role = 'parent'
WHERE p.phone IS NOT NULL AND p.phone != ''
ORDER BY normalize_phone(p.phone);

SELECT 
  'STUDENTS PARENT_PHONES' as type,
  id,
  name,
  parent_phone as original_phone,
  normalize_phone(parent_phone) as normalized,
  school_id
FROM students
WHERE parent_phone IS NOT NULL AND parent_phone != ''
ORDER BY normalize_phone(parent_phone);

-- 3. إنشاء الروابط باستخدام normalize_phone (أكثر تسامحاً)
INSERT INTO public.student_parents (school_id, student_id, parent_id)
SELECT DISTINCT
  s.school_id,
  s.id,
  p.id
FROM public.students s
INNER JOIN public.profiles p
  ON normalize_phone(p.phone) = normalize_phone(s.parent_phone)
INNER JOIN public.user_roles r
  ON r.user_id = p.id AND r.role = 'parent'
WHERE s.parent_phone IS NOT NULL
  AND s.parent_phone <> ''
  AND normalize_phone(p.phone) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM public.student_parents sp 
    WHERE sp.student_id = s.id AND sp.parent_id = p.id
  )
ON CONFLICT (student_id, parent_id) DO NOTHING;

-- 4. عرض الروابط اللي اتعملت
SELECT 
  'CREATED LINKS' as type,
  s.name as student_name,
  s.parent_phone as student_phone,
  p.full_name as parent_name,
  p.phone as parent_phone,
  sp.school_id,
  r.approval_status
FROM student_parents sp
JOIN students s ON s.id = sp.student_id
JOIN profiles p ON p.id = sp.parent_id
JOIN user_roles r ON r.user_id = p.id
ORDER BY s.created_at DESC
LIMIT 10;

-- 5. إجمالي الروابط
SELECT 
  'TOTAL LINKS' as type,
  COUNT(*) as total_links
FROM student_parents;

-- 6. إنشاء trigger قوي للمستقبل
CREATE OR REPLACE FUNCTION public.sync_student_parent_by_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id uuid;
  v_norm_student_phone text;
BEGIN
  v_norm_student_phone := public.normalize_phone(NEW.parent_phone);
  
  IF v_norm_student_phone IS NULL OR v_norm_student_phone = '' THEN
    RETURN NEW;
  END IF;
  
  -- ابحث عن ولي أمر بنفس الرقم (حتى لو مش approved)
  SELECT p.id INTO v_parent_id
  FROM public.profiles p
  INNER JOIN public.user_roles r ON r.user_id = p.id
  WHERE public.normalize_phone(p.phone) = v_norm_student_phone
    AND r.role = 'parent'
  LIMIT 1;
  
  IF v_parent_id IS NOT NULL THEN
    INSERT INTO public.student_parents (school_id, student_id, parent_id)
    VALUES (NEW.school_id, NEW.id, v_parent_id)
    ON CONFLICT (student_id, parent_id) DO NOTHING;
    
    RAISE NOTICE '✅ Linked student % to parent %', NEW.id, v_parent_id;
  ELSE
    RAISE NOTICE '⚠️ No parent found for phone: %', NEW.parent_phone;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_student_parent_by_phone ON public.students;
CREATE TRIGGER tr_sync_student_parent_by_phone
  AFTER INSERT OR UPDATE OF parent_phone ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_student_parent_by_phone();

-- 7. Trigger لولي الأمر لما يسجل
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
  
  -- Only for parents
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = NEW.id AND role = 'parent'
  ) THEN
    RETURN NEW;
  END IF;
  
  -- Link ALL matching students
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

NOTIFY pgrst, 'reload schema';
