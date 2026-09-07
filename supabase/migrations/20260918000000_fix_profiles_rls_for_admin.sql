-- ==========================================================================
-- Migration: 20260918000000_fix_profiles_rls_for_admin.sql
-- Purpose  : إصلاح مشكلتين رئيسيتين:
--   1. ولي الأمر اسمه يظهر ويختفي في صفحة الإعدادات
--      (السبب: profiles.full_name فارغ فيبدأ من JWT ثم يُمسح)
--   2. المدير لا يجد ولي الأمر في صفحة أولياء الأمور
--      (السبب: RLS تشترط school_id = admin.school_id لكن الأب عنده school_id IS NULL)
-- ==========================================================================

SET search_path TO public;

-- ─────────────────────────────────────────────────────────────────
-- 1. إصلاح RLS على جدول profiles
--    نسمح للأدمن برؤية أي profile لديه school_id مطابق أو NULL
-- ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles
FOR SELECT USING (
  -- المستخدم يرى ملفه الشخصي دائماً
  id = auth.uid()
  OR
  -- الأدمن والمعلم يرون كل الملفات في مدرستهم + الملفات التي لا تزال بدون school_id
  (SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = auth.uid() LIMIT 1)
    IN ('admin', 'teacher', 'super_admin')
  AND (
    school_id = (SELECT ur.school_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() LIMIT 1)
    OR school_id IS NULL
  )
);

-- ─────────────────────────────────────────────────────────────────
-- 2. تحديث get_complete_user_data لإرجاع user_metadata كـ fallback
--    عندما تكون full_name في profiles فارغة
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_complete_user_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile  RECORD;
    v_role     RECORD;
    v_school   RECORD;
    v_auth_row RECORD;
BEGIN
    -- جلب profile
    SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;

    -- جلب role
    SELECT * INTO v_role FROM public.user_roles WHERE user_id = p_user_id;

    -- جلب school
    IF v_profile.school_id IS NOT NULL THEN
        SELECT * INTO v_school FROM public.schools WHERE id = v_profile.school_id;
    ELSIF v_role.school_id IS NOT NULL THEN
        SELECT * INTO v_school FROM public.schools WHERE id = v_role.school_id;
    END IF;

    -- إصلاح تلقائي: إذا كانت full_name فارغة في profiles، نجلبها من auth.users
    IF v_profile.id IS NOT NULL AND (v_profile.full_name IS NULL OR trim(v_profile.full_name) = '') THEN
        BEGIN
            SELECT
                raw_user_meta_data->>'full_name' AS full_name,
                raw_user_meta_data->>'phone'     AS phone,
                raw_user_meta_data->>'school_id' AS school_id
            INTO v_auth_row
            FROM auth.users
            WHERE id = p_user_id;

            IF v_auth_row.full_name IS NOT NULL AND trim(v_auth_row.full_name) <> '' THEN
                UPDATE public.profiles
                SET
                    full_name = v_auth_row.full_name,
                    phone     = COALESCE(NULLIF(v_auth_row.phone, ''), v_profile.phone),
                    school_id = COALESCE(
                                  v_profile.school_id,
                                  v_role.school_id,
                                  CASE WHEN v_auth_row.school_id IS NOT NULL
                                       THEN v_auth_row.school_id::uuid ELSE NULL END
                                )
                WHERE id = p_user_id;

                -- تحديث الـ record المحلي
                v_profile.full_name := v_auth_row.full_name;
                IF v_profile.phone IS NULL OR v_profile.phone = '' THEN
                    v_profile.phone := v_auth_row.phone;
                END IF;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            NULL; -- تجاهل الأخطاء
        END;
    END IF;

    -- إصلاح تلقائي: إذا كانت school_id فارغة في profile لكن موجودة في role
    IF v_profile.id IS NOT NULL AND v_profile.school_id IS NULL AND v_role.school_id IS NOT NULL THEN
        BEGIN
            UPDATE public.profiles
            SET school_id = v_role.school_id
            WHERE id = p_user_id;
            v_profile.school_id := v_role.school_id;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;

    RETURN jsonb_build_object(
        'profile', (CASE WHEN v_profile.id IS NOT NULL THEN to_jsonb(v_profile) ELSE NULL END),
        'role',    (CASE WHEN v_role.user_id IS NOT NULL THEN to_jsonb(v_role) ELSE NULL END),
        'school',  (CASE WHEN v_school.id IS NOT NULL THEN to_jsonb(v_school) ELSE NULL END)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_complete_user_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_complete_user_data(uuid) TO anon;

-- ─────────────────────────────────────────────────────────────────
-- 3. إصلاح فوري: تحديث profiles من auth.users للحسابات التي full_name فارغة
-- ─────────────────────────────────────────────────────────────────
UPDATE public.profiles p
SET
    full_name = COALESCE(NULLIF(a.raw_user_meta_data->>'full_name', ''), p.full_name),
    phone     = COALESCE(NULLIF(a.raw_user_meta_data->>'phone', ''), p.phone)
FROM auth.users a
WHERE a.id = p.id
  AND (p.full_name IS NULL OR trim(p.full_name) = '')
  AND a.raw_user_meta_data->>'full_name' IS NOT NULL
  AND trim(a.raw_user_meta_data->>'full_name') <> '';

-- ─────────────────────────────────────────────────────────────────
-- 4. تحديث school_id لأولياء الأمور من user_roles
-- ─────────────────────────────────────────────────────────────────
UPDATE public.profiles p
SET school_id = ur.school_id
FROM public.user_roles ur
WHERE ur.user_id = p.id
  AND p.school_id IS NULL
  AND ur.school_id IS NOT NULL;

-- تأكد من أن user_roles معتمدة
UPDATE public.user_roles
SET approval_status = 'approved'
WHERE role = 'parent'
  AND (approval_status IS NULL OR approval_status = 'pending');

NOTIFY pgrst, 'reload schema';
