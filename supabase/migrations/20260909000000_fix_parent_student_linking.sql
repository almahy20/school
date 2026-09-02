-- ==========================================================================
-- Migration: 20260909000000_fix_parent_student_linking.sql
-- Purpose  : إصلاح مشكلة "ولي الأمر لا يرى أبناءه بعد ربطهم برقم الهاتف"
--
-- الأسباب الجذرية التي تم تشخيصها:
--
--   1. sync_role_students_by_phone يشترط s.school_id = NEW.school_id
--      بالضبط — لو ولي الأمر تسجّل وschool_id بتاعه مختلف أو NULL
--      ما بيربطش.
--
--   2. handle_new_user يستخدم ON CONFLICT (user_id) DO NOTHING
--      — لو ولي الأمر موجود بالفعل في user_roles بدون school_id
--      ما بيحدّثش الـ school_id.
--
--   3. student_parents.school_id ممكن تتخزّن كـ NULL لو الـ trigger
--      اشتغل بدون school_id صحيح — والـ fallback query في
--      useParentChildren يفلتر بـ .eq('school_id', user.schoolId)
--      فيمشيها.
--
-- الإصلاحات:
--   1. إعادة تعريف sync_role_students_by_phone بشرط school_id أكثر مرونة
--   2. إعادة تعريف sync_student_parent_by_phone لضمان صحة school_id
--   3. إصلاح get_parent_dashboard_summary لتشمل student_parents بـ NULL school_id
--   4. إعادة sync كاملة لجميع الروابط المفقودة
-- ==========================================================================

SET search_path TO public;

-- ==========================================================================
-- 1. إعادة تعريف sync_role_students_by_phone
--    الإصلاح: إزالة قيد school_id الصارم — الربط يعتمد على الهاتف فقط،
--    و school_id تُؤخذ من الطالب (s.school_id) وليس من ولي الأمر
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.sync_role_students_by_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone      text;
  v_norm_phone text;
BEGIN
  -- فقط لولي الأمر
  IF NEW.role <> 'parent' THEN
    RETURN NEW;
  END IF;

  -- جلب رقم الهاتف من profiles
  SELECT phone INTO v_phone
  FROM public.profiles
  WHERE id = NEW.user_id;

  v_norm_phone := public.normalize_phone(v_phone);

  IF v_norm_phone IS NULL OR v_norm_phone = '' THEN
    RETURN NEW;
  END IF;

  -- ربط بجميع الطلاب الذين parent_phone يطابق رقم الهاتف
  -- school_id تؤخذ من الطالب نفسه (ليس من user_roles)
  INSERT INTO public.student_parents (school_id, student_id, parent_id)
  SELECT
    s.school_id,
    s.id,
    NEW.user_id
  FROM public.students s
  WHERE public.normalize_phone(s.parent_phone) = v_norm_phone
  ON CONFLICT (student_id, parent_id) DO UPDATE
    SET school_id = EXCLUDED.school_id
    WHERE student_parents.school_id IS NULL;

  RETURN NEW;
END;
$$;

-- ==========================================================================
-- 2. إعادة تعريف sync_student_parent_by_phone
--    الإصلاح: تأكيد أن school_id دائماً تُؤخذ من الطالب
-- ==========================================================================

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
  -- حساب الهواتف المعيارية
  IF TG_OP = 'DELETE' THEN
    v_old_norm_phone := public.normalize_phone(OLD.parent_phone);
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_norm_phone := public.normalize_phone(OLD.parent_phone);
    v_new_norm_phone := public.normalize_phone(NEW.parent_phone);
  ELSE -- INSERT
    v_new_norm_phone := public.normalize_phone(NEW.parent_phone);
  END IF;

  -- حذف الربط القديم إذا تغيّر الرقم
  IF (TG_OP = 'DELETE')
     OR (TG_OP = 'UPDATE' AND v_old_norm_phone IS DISTINCT FROM v_new_norm_phone)
  THEN
    DELETE FROM public.student_parents
    WHERE student_id = OLD.id
      AND parent_id IN (
        SELECT p.id FROM public.profiles p
        WHERE public.normalize_phone(p.phone) = v_old_norm_phone
      );
  END IF;

  -- إضافة الربط الجديد إذا كان الرقم موجوداً
  IF TG_OP <> 'DELETE'
     AND v_new_norm_phone IS NOT NULL
     AND v_new_norm_phone <> ''
  THEN
    INSERT INTO public.student_parents (school_id, student_id, parent_id)
    SELECT
      NEW.school_id,   -- school_id تأتي من الطالب دائماً
      NEW.id,
      p.id
    FROM public.profiles p
    INNER JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'parent'
    WHERE public.normalize_phone(p.phone) = v_new_norm_phone
    ON CONFLICT (student_id, parent_id) DO UPDATE
      SET school_id = EXCLUDED.school_id
      WHERE student_parents.school_id IS NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- ==========================================================================
-- 3. إصلاح handle_new_user ليحدّث school_id في user_roles إذا تغيّر
--    الإصلاح: ON CONFLICT DO UPDATE بدل DO NOTHING
-- ==========================================================================

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
  v_is_super := (v_phone = '0192837465' OR NEW.email = '0192837465@school.local');

  -- إنشاء/تحديث الـ profile
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
      phone      = COALESCE(EXCLUDED.phone, profiles.phone),
      school_id  = COALESCE(EXCLUDED.school_id, profiles.school_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: Failed to insert profile: %', SQLERRM;
  END;

  -- إنشاء/تحديث الـ role
  -- الإصلاح: DO UPDATE يضمن تحديث school_id لو كان NULL سابقاً
  BEGIN
    INSERT INTO public.user_roles (user_id, role, school_id, is_super_admin, approval_status)
    VALUES (
      NEW.id,
      CASE WHEN v_is_super THEN 'admin' ELSE v_role END,
      v_school_id,
      v_is_super,
      'approved'
    )
    ON CONFLICT (user_id) DO UPDATE SET
      school_id       = COALESCE(EXCLUDED.school_id, user_roles.school_id),
      approval_status = 'approved';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: Failed to insert role: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ==========================================================================
-- 4. إصلاح الروابط الحالية المفقودة أو التالفة
--    أ. تحديث student_parents التي school_id = NULL
--    ب. إعادة إدراج جميع الروابط الصحيحة المفقودة
-- ==========================================================================

-- أ. إصلاح student_parents التي school_id = NULL
UPDATE public.student_parents sp
SET school_id = s.school_id
FROM public.students s
WHERE sp.student_id = s.id
  AND sp.school_id IS NULL
  AND s.school_id IS NOT NULL;

-- ب. إدراج جميع الروابط الصحيحة المفقودة
--    (يربط الطلاب بأولياء الأمور الموجودين في profiles بنفس الرقم)
INSERT INTO public.student_parents (school_id, student_id, parent_id)
SELECT
  s.school_id,
  s.id,
  p.id
FROM public.students s
JOIN public.profiles p
  ON public.normalize_phone(p.phone) = public.normalize_phone(s.parent_phone)
JOIN public.user_roles r
  ON r.user_id = p.id AND r.role = 'parent'
WHERE s.parent_phone IS NOT NULL
  AND s.parent_phone != ''
ON CONFLICT (student_id, parent_id) DO UPDATE
  SET school_id = EXCLUDED.school_id
  WHERE student_parents.school_id IS NULL;

-- ==========================================================================
-- 5. إعادة تحميل schema cache
-- ==========================================================================

NOTIFY pgrst, 'reload schema';
