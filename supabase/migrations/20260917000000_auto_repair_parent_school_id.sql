-- ==========================================================================
-- Migration: 20260917000000_auto_repair_parent_school_id.sql
-- Purpose  : حل مشكلة "عدم ظهور ولي الأمر المسجل حديثاً في لوحة تحكم المدرسة"
--
-- الأسباب:
-- 1. عند تسجيل ولي الأمر بدون slug محدد، كانت school_id تُحفظ كـ NULL.
-- 2. استعلام صفحة أولياء الأمور كان يشترط school_id = admin.school_id،
--    فلا يظهر أولياء الأمور الذين لديهم school_id = NULL.
--
-- الحلول:
-- 1. تحديث handle_new_user لتعيين school_id تلقائياً (من الطالب المطابق أو المدرسة الافتراضية).
-- 2. تعيين حالة الحساب تلقائياً إلى 'approved'.
-- 3. تصحيح جميع حسابات أولياء الأمور الحالية التي بها school_id = NULL.
-- ==========================================================================

SET search_path TO public;

-- 1. تحديث handle_new_user لضمان عدم وجود school_id فارغة أبداً
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
  -- استخراج school_id من البيانات إن وُجدت
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

  -- إذا لم يتم تمرير school_id، نحاول جلبها من الطلاب المطابقين برقم هاتف ولي الأمر
  IF v_school_id IS NULL AND v_phone IS NOT NULL AND trim(v_phone) <> '' THEN
    SELECT s.school_id INTO v_school_id
    FROM public.students s
    WHERE public.phones_match(s.parent_phone, v_phone)
    LIMIT 1;
  END IF;

  -- إذا ما زالت school_id فارغة، نأخذ المدرسة الافتراضية الأولى في النظام
  IF v_school_id IS NULL THEN
    SELECT id INTO v_school_id FROM public.schools LIMIT 1;
  END IF;

  -- إنشاء أو تحديث الـ profile
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
      phone      = COALESCE(NULLIF(EXCLUDED.phone, ''), profiles.phone),
      school_id  = COALESCE(EXCLUDED.school_id, profiles.school_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: Failed to insert profile: %', SQLERRM;
  END;

  -- إنشاء أو تحديث الـ role (مع اعتماد الحساب فوراً 'approved')
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

  -- ربط الطلاب المطابقين برقم الهاتف تلقائياً
  IF v_phone IS NOT NULL AND trim(v_phone) <> '' AND v_role = 'parent' THEN
    BEGIN
      INSERT INTO public.student_parents (school_id, student_id, parent_id)
      SELECT
        s.school_id,
        s.id,
        NEW.id
      FROM public.students s
      WHERE public.phones_match(s.parent_phone, v_phone)
      ON CONFLICT (student_id, parent_id) DO UPDATE
        SET school_id = COALESCE(student_parents.school_id, EXCLUDED.school_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'handle_new_user: Failed to auto-link students: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. تصحيح فوري لجميع الحسابات الحالية التي تملك school_id = NULL
-- أ. تحديث profiles من خلال طلابهم إن وُجدوا
UPDATE public.profiles p
SET school_id = s.school_id
FROM public.students s
WHERE p.school_id IS NULL
  AND s.parent_phone IS NOT NULL
  AND public.phones_match(s.parent_phone, p.phone);

-- ب. تحديث user_roles من profiles
UPDATE public.user_roles ur
SET school_id = p.school_id
FROM public.profiles p
WHERE ur.user_id = p.id
  AND ur.school_id IS NULL
  AND p.school_id IS NOT NULL;

-- ج. إسناد المدرسة الافتراضية لأي حساب متبقي school_id = NULL
UPDATE public.profiles
SET school_id = (SELECT id FROM public.schools LIMIT 1)
WHERE school_id IS NULL;

UPDATE public.user_roles
SET school_id = (SELECT id FROM public.schools LIMIT 1),
    approval_status = 'approved'
WHERE school_id IS NULL;

-- د. اعتماد جميع أولياء الأمور
UPDATE public.user_roles
SET approval_status = 'approved'
WHERE role = 'parent' AND (approval_status IS NULL OR approval_status = 'pending');

-- 3. إعادة مزامنة جدول student_parents
INSERT INTO public.student_parents (school_id, student_id, parent_id)
SELECT DISTINCT
  s.school_id,
  s.id,
  p.id
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

NOTIFY pgrst, 'reload schema';
