-- ==========================================================================
-- Migration: 20260918200000_fix_missing_trigger_and_repair_users.sql
-- Purpose  : إصلاح المشكلة الجذرية: handle_new_user trigger لا تعمل
--
-- النتيجة: profiles و user_roles فارغة تماماً لكل مستخدم جديد
-- الحل:
-- 1. إعادة إنشاء trigger بشكل صحيح على auth.users
-- 2. إصلاح فوري لجميع المستخدمين الذين ليس لهم profile أو role
-- ==========================================================================

SET search_path TO public;

-- ─────────────────────────────────────────────────────────────────
-- 1. إعادة إنشاء handle_new_user بشكل صحيح
-- ─────────────────────────────────────────────────────────────────
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
  -- استخراج school_id
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

  -- إذا لم يتم تمرير school_id، نحاول جلبها من الطلاب المطابقين
  IF v_school_id IS NULL AND v_phone IS NOT NULL AND trim(v_phone) <> '' THEN
    SELECT s.school_id INTO v_school_id
    FROM public.students s
    WHERE public.phones_match(s.parent_phone, v_phone)
    LIMIT 1;
  END IF;

  -- إذا ما زالت school_id فارغة، نأخذ المدرسة الافتراضية
  IF v_school_id IS NULL THEN
    SELECT id INTO v_school_id FROM public.schools ORDER BY created_at LIMIT 1;
  END IF;

  -- إنشاء profile
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
      full_name  = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
      phone      = COALESCE(NULLIF(EXCLUDED.phone, ''), profiles.phone),
      school_id  = COALESCE(EXCLUDED.school_id, profiles.school_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: profiles insert failed: %', SQLERRM;
  END;

  -- إنشاء user_role
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
    RAISE WARNING 'handle_new_user: user_roles insert failed: %', SQLERRM;
  END;

  -- ربط الطلاب تلقائياً
  IF v_phone IS NOT NULL AND trim(v_phone) <> '' AND v_role = 'parent' THEN
    BEGIN
      INSERT INTO public.student_parents (school_id, student_id, parent_id)
      SELECT s.school_id, s.id, NEW.id
      FROM public.students s
      WHERE public.phones_match(s.parent_phone, v_phone)
      ON CONFLICT (student_id, parent_id) DO UPDATE
        SET school_id = COALESCE(student_parents.school_id, EXCLUDED.school_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'handle_new_user: student_parents insert failed: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────
-- 2. حذف وإعادة إنشاء الـ trigger
-- ─────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────
-- 3. إصلاح فوري: إنشاء profiles و user_roles للمستخدمين الحاليين
--    الذين ليس لهم profile أو role (الحسابات الجديدة المتأثرة)
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_user   RECORD;
  v_school_id uuid;
  v_phone  text;
  v_role   text;
BEGIN
  -- اجلب كل مستخدمي auth.users الذين لا يوجد لهم profile أو role
  FOR v_user IN
    SELECT au.id, au.email, au.raw_user_meta_data, au.created_at
    FROM auth.users au
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id)
       OR NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = au.id)
    ORDER BY au.created_at
  LOOP
    v_phone := COALESCE(v_user.raw_user_meta_data->>'phone', '');
    v_role  := COALESCE(v_user.raw_user_meta_data->>'role', 'parent');

    -- جلب school_id من meta أولاً
    BEGIN
      IF (v_user.raw_user_meta_data->>'school_id') IS NOT NULL
         AND (v_user.raw_user_meta_data->>'school_id') != '' THEN
        v_school_id := (v_user.raw_user_meta_data->>'school_id')::uuid;
      ELSE
        v_school_id := NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_school_id := NULL;
    END;

    -- fallback: ابحث عبر رقم الهاتف في الطلاب
    IF v_school_id IS NULL AND trim(v_phone) <> '' THEN
      SELECT s.school_id INTO v_school_id
      FROM public.students s
      WHERE public.phones_match(s.parent_phone, v_phone)
      LIMIT 1;
    END IF;

    -- fallback: أول مدرسة
    IF v_school_id IS NULL THEN
      SELECT id INTO v_school_id FROM public.schools ORDER BY created_at LIMIT 1;
    END IF;

    -- إنشاء أو تحديث profile
    INSERT INTO public.profiles (id, full_name, email, phone, school_id)
    VALUES (
      v_user.id,
      COALESCE(NULLIF(v_user.raw_user_meta_data->>'full_name', ''), 'مستخدم'),
      v_user.email,
      v_phone,
      v_school_id
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name = COALESCE(NULLIF(EXCLUDED.full_name, 'مستخدم'), profiles.full_name),
      phone     = COALESCE(NULLIF(EXCLUDED.phone, ''), profiles.phone),
      school_id = COALESCE(EXCLUDED.school_id, profiles.school_id);

    -- إنشاء user_role: INSERT إذا غير موجود، UPDATE إذا موجود
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_user.id) THEN
      INSERT INTO public.user_roles (user_id, role, school_id, is_super_admin, approval_status)
      VALUES (v_user.id, v_role, v_school_id, false, 'approved');
    ELSE
      UPDATE public.user_roles
      SET school_id       = COALESCE(school_id, v_school_id),
          approval_status = 'approved'
      WHERE user_id = v_user.id;
    END IF;

    -- ربط الطلاب تلقائياً
    IF trim(v_phone) <> '' AND v_role = 'parent' THEN
      INSERT INTO public.student_parents (school_id, student_id, parent_id)
      SELECT s.school_id, s.id, v_user.id
      FROM public.students s
      WHERE public.phones_match(s.parent_phone, v_phone)
      ON CONFLICT (student_id, parent_id) DO NOTHING;
    END IF;

  END LOOP;
  RAISE NOTICE 'Done repairing all users';
END;
$$;


-- ─────────────────────────────────────────────────────────────────
-- 4. التحقق من النتيجة
-- ─────────────────────────────────────────────────────────────────
SELECT 
  'auth.users' AS source,
  COUNT(*) AS total
FROM auth.users
UNION ALL
SELECT 'profiles', COUNT(*) FROM public.profiles
UNION ALL
SELECT 'user_roles', COUNT(*) FROM public.user_roles;

NOTIFY pgrst, 'reload schema';
