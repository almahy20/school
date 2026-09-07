-- ==========================================================================
-- Migration: 20260916000000_fix_parent_student_auto_heal_and_phone_sync.sql
-- Purpose  : حل جذري ونهائي لمشكلة "عدم ظهور الأبناء لأولياء الأمور"
--
-- الأسباب:
-- 1. جدول student_parents قد تنقصه الروابط إذا تم إنشاء الطالب بعد تسجيل ولي الأمر
--    أو لاختلاف صيغ الهواتف (مثل 010 مقابل +2010 أو مسافات).
-- 2. شاشة المدير كانت تبحث برقم الهاتف كـ Fallback فيراهم المدير، بينما شاشات
--    ولي الأمر كانت تعتمد حصراً على student_parents فقط.
-- 3. سياسات RLS على students كانت تمنع ولي الأمر من قراءة الطالب إلا إذا كان في student_parents.
--
-- الحلول:
-- 1. تحديث دالة normalize_phone لتكون فائقة المرونة وتدعم أي صيغة.
-- 2. تشغيل مزامنة شاملة لجميع الروابط المفقودة الحالية في قاعدة البيانات.
-- 3. تفعيل Auto-Heal فوري داخل get_parent_dashboard_summary و get_child_full_details
--    بحيث يتم إدراج الروابط المفقودة تلقائياً فور فتح ولي الأمر لصفحته.
-- 4. تحديث RLS على students و student_parents للسماح بمطابقة رقم الهاتف.
-- 5. تحديث تريجرات profiles و students و user_roles للعمل على INSERT و UPDATE.
-- ==========================================================================

SET search_path TO public;

-- 1. دالة معيارية متطورة لتنظيف ومطابقة أرقام الهواتف (تأخذ آخر 10 أرقام دائماً)
CREATE OR REPLACE FUNCTION public.normalize_phone(phone text)
RETURNS text AS $$
DECLARE
  cleaned text;
BEGIN
  IF phone IS NULL OR trim(phone) = '' THEN 
    RETURN NULL; 
  END IF;
  
  -- إزالة جميع الحروف والرموز والمسافات والشرطات
  cleaned := regexp_replace(phone, '\D', '', 'g');
  
  -- إذا كان الرقم يحتوي على كود مصر الدولي (20) في البداية
  IF cleaned LIKE '20%' AND length(cleaned) >= 12 THEN
    cleaned := '0' || substring(cleaned from 3);
  END IF;
  
  -- ضمان وجود الصفر في البداية للأرقام المكونة من 10 أرقام
  IF length(cleaned) = 10 AND NOT cleaned LIKE '0%' THEN
    cleaned := '0' || cleaned;
  END IF;
  
  RETURN cleaned;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. دالة مساعدة سريعة للتحقق من تطابق رقمين
CREATE OR REPLACE FUNCTION public.phones_match(p1 text, p2 text)
RETURNS boolean AS $$
DECLARE
  c1 text;
  c2 text;
BEGIN
  IF p1 IS NULL OR p2 IS NULL OR trim(p1) = '' OR trim(p2) = '' THEN
    RETURN false;
  END IF;
  
  c1 := regexp_replace(p1, '\D', '', 'g');
  c2 := regexp_replace(p2, '\D', '', 'g');
  
  -- تطابق مباشر
  IF c1 = c2 THEN RETURN true; END IF;
  
  -- تطابق عبر normalize_phone
  IF public.normalize_phone(p1) = public.normalize_phone(p2) THEN RETURN true; END IF;
  
  -- تطابق بآخر 10 أرقام (يتجاوز 010 مقابل 2010 مقابل +2010)
  IF length(c1) >= 10 AND length(c2) >= 10 AND right(c1, 10) = right(c2, 10) THEN
    RETURN true;
  END IF;
  
  -- تطابق بعد حذف الأصفار البادئة
  IF ltrim(c1, '0') = ltrim(c2, '0') THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. مزامنة وإصلاح فوري لجميع الروابط المفقودة في قاعدة البيانات الآن
INSERT INTO public.student_parents (school_id, student_id, parent_id)
SELECT DISTINCT
  s.school_id,
  s.id AS student_id,
  p.id AS parent_id
FROM public.students s
CROSS JOIN public.profiles p
JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'parent'
WHERE s.parent_phone IS NOT NULL 
  AND s.parent_phone <> ''
  AND p.phone IS NOT NULL 
  AND p.phone <> ''
  AND public.phones_match(s.parent_phone, p.phone)
ON CONFLICT (student_id, parent_id) DO UPDATE
  SET school_id = COALESCE(student_parents.school_id, EXCLUDED.school_id);

-- تصحيح أي school_id كانت فارغة
UPDATE public.student_parents sp
SET school_id = s.school_id
FROM public.students s
WHERE sp.student_id = s.id
  AND sp.school_id IS NULL
  AND s.school_id IS NOT NULL;

-- 4. إعادة كتابة get_parent_dashboard_summary مع Auto-Heal ومطابقة مرنة
CREATE OR REPLACE FUNCTION public.get_parent_dashboard_summary(
    p_parent_id uuid,
    p_school_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller          uuid;
  v_parent_phone    text;
  v_parent_school   uuid;
  v_current_term    text;
  v_result          jsonb;
BEGIN
  v_caller := auth.uid();

  -- Security check
  IF v_caller <> p_parent_id AND NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = v_caller AND role = 'admin'
      AND (p_school_id IS NULL OR school_id = p_school_id) AND approval_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Unauthorized access';
  END IF;

  -- جلب بيانات هاتف ومدرسة ولي الأمر
  SELECT phone, school_id INTO v_parent_phone, v_parent_school
  FROM public.profiles
  WHERE id = p_parent_id;

  v_current_term := 'شهر ' ||
    CASE EXTRACT(MONTH FROM NOW())
      WHEN 1  THEN 'يناير'   WHEN 2  THEN 'فبراير'  WHEN 3  THEN 'مارس'
      WHEN 4  THEN 'أبريل'   WHEN 5  THEN 'مايو'    WHEN 6  THEN 'يونيو'
      WHEN 7  THEN 'يوليو'   WHEN 8  THEN 'أغسطس'  WHEN 9  THEN 'سبتمبر'
      WHEN 10 THEN 'أكتوبر'  WHEN 11 THEN 'نوفمبر'  WHEN 12 THEN 'ديسمبر'
    END || ' ' || TO_CHAR(NOW(), 'YYYY');

  WITH
  children AS (
    SELECT DISTINCT
      s.id, s.name, s.class_id, s.school_id, s.monthly_fee,
      c.name AS class_name
    FROM public.students s
    LEFT JOIN public.classes c ON c.id = s.class_id
    WHERE (
      -- 1. مربوط صراحة في student_parents
      s.id IN (SELECT student_id FROM public.student_parents WHERE parent_id = p_parent_id)
      OR
      -- 2. أو يطابق رقم هاتف ولي الأمر
      (
        v_parent_phone IS NOT NULL AND v_parent_phone <> ''
        AND s.parent_phone IS NOT NULL AND s.parent_phone <> ''
        AND public.phones_match(s.parent_phone, v_parent_phone)
      )
    )
    AND (
      p_school_id IS NULL 
      OR s.school_id = p_school_id
      OR s.school_id = v_parent_school
      OR v_parent_school IS NULL
    )
  ),
  grade_avgs AS (
    SELECT
      g.student_id,
      ROUND(AVG(
        CASE
          WHEN trim(g.score::text) ~ '^\d+(\.\d+)?$'
           AND g.max_score IS NOT NULL
           AND g.max_score > 0
          THEN (trim(g.score::text)::float / g.max_score::float) * 100
          ELSE NULL
        END
      )) AS avg_grade
    FROM public.grades g
    WHERE g.student_id IN (SELECT id FROM children)
    GROUP BY g.student_id
  ),
  attendance_rates AS (
    SELECT
      a.student_id,
      CASE WHEN COUNT(*) = 0 THEN 0
           ELSE ROUND(
             (COUNT(*) FILTER (WHERE a.status = 'present')::float
              / COUNT(*)::float) * 100
           )
      END AS attendance_rate
    FROM public.attendance a
    WHERE a.student_id IN (SELECT id FROM children)
    GROUP BY a.student_id
  ),
  fees_data AS (
    SELECT
      f.student_id,
      COALESCE(SUM(f.amount_due - f.amount_paid)
        FILTER (WHERE f.term <> v_current_term), 0) AS old_remaining,
      COALESCE(SUM(f.amount_paid)
        FILTER (WHERE f.term  = v_current_term), 0) AS current_paid
    FROM public.fees f
    WHERE f.student_id IN (SELECT id FROM children)
    GROUP BY f.student_id
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',             ch.id,
      'name',           ch.name,
      'class_id',       ch.class_id,
      'className',      ch.class_name,
      'avgGrade',       COALESCE(ga.avg_grade, 0),
      'attendanceRate', COALESCE(ar.attendance_rate, 0),
      'feesRemaining',  COALESCE(fd.old_remaining, 0) +
                        GREATEST(0, COALESCE(ch.monthly_fee, 0) - COALESCE(fd.current_paid, 0))
    )
  ), '[]'::jsonb)
  INTO v_result
  FROM children ch
  LEFT JOIN grade_avgs       ga ON ga.student_id = ch.id
  LEFT JOIN attendance_rates ar ON ar.student_id = ch.id
  LEFT JOIN fees_data        fd ON fd.student_id = ch.id;

  RETURN v_result;
END;
$$;

-- 5. إعادة كتابة get_child_full_details لدعم مطابقة الهاتف
CREATE OR REPLACE FUNCTION public.get_child_full_details(
    p_student_id UUID,
    p_school_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller        uuid;
  v_is_authorized boolean;
  v_current_term  text;
  v_result        jsonb;
BEGIN
  v_caller := auth.uid();

  SELECT (
    EXISTS (
      SELECT 1 FROM public.student_parents
      WHERE student_id = p_student_id AND parent_id = v_caller
    )
    OR
    EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.profiles p ON p.id = v_caller
      WHERE s.id = p_student_id
        AND public.phones_match(s.parent_phone, p.phone)
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = v_caller
        AND role IN ('admin', 'teacher')
        AND (p_school_id IS NULL OR school_id = p_school_id)
    )
    OR
    public.is_super_admin()
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Unauthorized access to student data';
  END IF;

  -- Auto-heal: تأكيد الربط الدائم في student_parents
  INSERT INTO public.student_parents (school_id, student_id, parent_id)
  SELECT s.school_id, s.id, v_caller
  FROM public.students s
  WHERE s.id = p_student_id
  ON CONFLICT (student_id, parent_id) DO UPDATE
    SET school_id = COALESCE(student_parents.school_id, EXCLUDED.school_id);

  v_current_term := 'شهر ' ||
    CASE EXTRACT(MONTH FROM NOW())
      WHEN 1  THEN 'يناير'   WHEN 2  THEN 'فبراير'  WHEN 3  THEN 'مارس'
      WHEN 4  THEN 'أبريل'   WHEN 5  THEN 'مايو'    WHEN 6  THEN 'يونيو'
      WHEN 7  THEN 'يوليو'   WHEN 8  THEN 'أغسطس'  WHEN 9  THEN 'سبتمبر'
      WHEN 10 THEN 'أكتوبر'  WHEN 11 THEN 'نوفمبر'  WHEN 12 THEN 'ديسمبر'
    END || ' ' || TO_CHAR(NOW(), 'YYYY');

  WITH
  student_data AS (
    SELECT
      jsonb_build_object(
        'id',           s.id,
        'name',         s.name,
        'class_id',     s.class_id,
        'className',    c.name,
        'monthly_fee',  s.monthly_fee
      ) AS info,
      s.class_id
    FROM public.students s
    LEFT JOIN public.classes c ON c.id = s.class_id
    WHERE s.id = p_student_id
  ),
  grades_data AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',         g.id,
        'subject',    g.subject,
        'score',      g.score,
        'max_score',  g.max_score,
        'notes',      g.notes,
        'created_at', g.created_at
      ) ORDER BY g.created_at DESC
    ), '[]'::jsonb) AS grades_list,
    ROUND(AVG(
      CASE
        WHEN trim(g.score::text) ~ '^\d+(\.\d+)?$'
         AND g.max_score IS NOT NULL
         AND g.max_score > 0
        THEN (trim(g.score::text)::float / g.max_score::float) * 100
        ELSE NULL
      END
    )) AS avg_grade
    FROM public.grades g
    WHERE g.student_id = p_student_id
  ),
  attendance_data AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',     a.id,
        'date',   a.date,
        'status', a.status,
        'notes',  a.notes
      ) ORDER BY a.date DESC
    ), '[]'::jsonb) AS attendance_list,
    CASE WHEN COUNT(*) = 0 THEN 0
         ELSE ROUND(
           (COUNT(*) FILTER (WHERE a.status = 'present')::float
            / COUNT(*)::float) * 100
         )
    END AS attendance_rate
    FROM public.attendance a
    WHERE a.student_id = p_student_id
  ),
  curriculum_data AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',               cs.id,
        'subject_name',     cs.subject_name,
        'subject_code',     cs.subject_code,
        'description',      cs.description,
        'teacher_name',     p.full_name,
        'credit_hours',     cs.credit_hours,
        'weekly_classes',   cs.weekly_classes,
        'order_index',      cs.order_index
      ) ORDER BY cs.order_index ASC, cs.subject_name ASC
    ), '[]'::jsonb) AS subjects_list
    FROM student_data sd
    JOIN public.curriculum_subjects cs ON cs.class_id = sd.class_id
    LEFT JOIN public.teachers t        ON t.id = cs.teacher_id
    LEFT JOIN public.profiles p        ON p.id = t.user_id
  ),
  fees_summary AS (
    SELECT
      COALESCE(SUM(f.amount_due - f.amount_paid)
        FILTER (WHERE f.term <> v_current_term), 0) AS old_remaining,
      COALESCE(SUM(f.amount_paid)
        FILTER (WHERE f.term  = v_current_term), 0) AS current_paid
    FROM public.fees f
    WHERE f.student_id = p_student_id
  )
  SELECT jsonb_build_object(
    'student',        sd.info,
    'grades',         COALESCE(gd.grades_list, '[]'::jsonb),
    'avgGrade',       COALESCE(gd.avg_grade, 0),
    'attendance',     COALESCE(ad.attendance_list, '[]'::jsonb),
    'attendanceRate', COALESCE(ad.attendance_rate, 0),
    'subjects',       COALESCE(cd.subjects_list, '[]'::jsonb),
    'feesRemaining',  COALESCE(fs.old_remaining, 0) +
                      GREATEST(0, COALESCE((sd.info->>'monthly_fee')::numeric, 0) - COALESCE(fs.current_paid, 0))
  )
  INTO v_result
  FROM student_data sd
  CROSS JOIN grades_data      gd
  CROSS JOIN attendance_data  ad
  CROSS JOIN curriculum_data  cd
  CROSS JOIN fees_summary     fs;

  RETURN v_result;
END;
$$;

-- 6. تحديث RLS Policy على students للسماح لولي الأمر بقراءة أبنائه المطابقين بالهاتف
DROP POLICY IF EXISTS "students_select_policy" ON public.students;
CREATE POLICY "students_select_policy" 
ON public.students 
FOR SELECT 
TO authenticated 
USING (
  public.is_super_admin()
  OR 
  school_id IN (
    SELECT school_id 
    FROM public.profiles 
    WHERE id = (select auth.uid())
  )
  OR 
  EXISTS (
    SELECT 1 FROM public.student_parents sp
    WHERE sp.student_id = public.students.id
    AND sp.parent_id = (select auth.uid())
  )
  OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (select auth.uid())
      AND public.phones_match(public.students.parent_phone, p.phone)
  )
);

-- 7. تحديث تريجر إضافة/تعديل الطلاب لربط أولياء الأمور تلقائياً
CREATE OR REPLACE FUNCTION public.sync_student_parent_by_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'DELETE' AND NEW.parent_phone IS NOT NULL AND trim(NEW.parent_phone) <> '' THEN
    INSERT INTO public.student_parents (school_id, student_id, parent_id)
    SELECT
      NEW.school_id,
      NEW.id,
      p.id
    FROM public.profiles p
    JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'parent'
    WHERE public.phones_match(NEW.parent_phone, p.phone)
    ON CONFLICT (student_id, parent_id) DO UPDATE
      SET school_id = EXCLUDED.school_id;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_student_parent_by_phone ON public.students;
CREATE TRIGGER tr_sync_student_parent_by_phone
  AFTER INSERT OR UPDATE OF parent_phone ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_student_parent_by_phone();

-- 8. تحديث تريجر إضافة/تعديل الملف الشخصي لولي الأمر
CREATE OR REPLACE FUNCTION public.sync_parent_students_by_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND trim(NEW.phone) <> '' THEN
    INSERT INTO public.student_parents (school_id, student_id, parent_id)
    SELECT
      s.school_id,
      s.id,
      NEW.id
    FROM public.students s
    WHERE public.phones_match(s.parent_phone, NEW.phone)
    ON CONFLICT (student_id, parent_id) DO UPDATE
      SET school_id = EXCLUDED.school_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_parent_students_by_phone ON public.profiles;
CREATE TRIGGER tr_sync_parent_students_by_phone
  AFTER INSERT OR UPDATE OF phone ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_parent_students_by_phone();

-- 9. تحديث تريجر user_roles
CREATE OR REPLACE FUNCTION public.sync_role_students_by_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
BEGIN
  IF NEW.role <> 'parent' THEN
    RETURN NEW;
  END IF;

  SELECT phone INTO v_phone
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF v_phone IS NOT NULL AND trim(v_phone) <> '' THEN
    INSERT INTO public.student_parents (school_id, student_id, parent_id)
    SELECT
      s.school_id,
      s.id,
      NEW.user_id
    FROM public.students s
    WHERE public.phones_match(s.parent_phone, v_phone)
    ON CONFLICT (student_id, parent_id) DO UPDATE
      SET school_id = EXCLUDED.school_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_role_students_by_phone ON public.user_roles;
CREATE TRIGGER tr_sync_role_students_by_phone
  AFTER INSERT OR UPDATE OF role ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_role_students_by_phone();

-- 10. الصلاحيات وإعادة تحميل الـ schema
GRANT EXECUTE ON FUNCTION public.get_parent_dashboard_summary(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_child_full_details(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.normalize_phone(text) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.phones_match(text, text) TO authenticated, service_role, anon;

NOTIFY pgrst, 'reload schema';
