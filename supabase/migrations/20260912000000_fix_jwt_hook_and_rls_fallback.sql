-- ==========================================================================
-- Migration: 20260912000000_fix_jwt_hook_and_rls_fallback.sql
-- Purpose  : إصلاح شامل لنظام الـ JWT Hook و RLS policies
--
-- المشاكل المُصلَحة:
--   1. custom_access_token_hook — LIMIT 1 بدون ORDER BY → نتيجة عشوائية
--      لو في أكتر من صف في user_roles لنفس المستخدم.
--      الإصلاح: ORDER BY is_super_admin DESC, role (admin قبل parent)
--
--   2. RLS policies على user_roles تعتمد على app_metadata من JWT.
--      لو الـ hook مش مفعّل في Dashboard → app_metadata فاضي →
--      user_roles_admin_read policy مش بتشتغل → الأدمن مش بيشوف المستخدمين.
--      الإصلاح: إضافة fallback policy تعتمد على user_metadata (يُعبّأ عند التسجيل)
--
--   3. إضافة full_name للـ JWT عشان AuthContext يتجنب RPC call
--      عند كل page navigation.
-- ==========================================================================

SET search_path TO public;

-- ==========================================================================
-- 1. إعادة بناء custom_access_token_hook بشكل صحيح
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims        jsonb;
  user_id       uuid;
  v_school_id   uuid;
  v_role        text;
  v_is_super    boolean;
  v_approval    text;
  v_full_name   text;
  v_phone       text;
BEGIN
  user_id := (event->>'user_id')::uuid;
  claims  := event->'claims';

  -- جلب دور المستخدم — ORDER BY يضمن الأولوية:
  -- super_admin أولاً، ثم admin، ثم teacher، ثم parent
  SELECT
    ur.school_id,
    ur.role,
    ur.is_super_admin,
    ur.approval_status
  INTO
    v_school_id,
    v_role,
    v_is_super,
    v_approval
  FROM public.user_roles ur
  WHERE ur.user_id = user_id
  ORDER BY
    ur.is_super_admin DESC NULLS LAST,
    CASE ur.role
      WHEN 'admin'   THEN 1
      WHEN 'teacher' THEN 2
      WHEN 'parent'  THEN 3
      ELSE               4
    END
  LIMIT 1;

  -- جلب الاسم ورقم الهاتف من profiles
  SELECT p.full_name, p.phone
  INTO   v_full_name, v_phone
  FROM   public.profiles p
  WHERE  p.id = user_id;

  -- تضمين البيانات في JWT فقط لو وُجد الدور
  IF v_role IS NOT NULL THEN
    claims := jsonb_set(
      claims,
      '{app_metadata}',
      COALESCE(claims->'app_metadata', '{}') || jsonb_build_object(
        'school_id',       v_school_id,
        'role',            v_role,
        'is_super_admin',  COALESCE(v_is_super, false),
        'approval_status', COALESCE(v_approval, 'approved'),
        'full_name',       COALESCE(v_full_name, ''),
        'phone',           COALESCE(v_phone, '')
      )
    );
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);

EXCEPTION WHEN OTHERS THEN
  -- لا نوقف تسجيل الدخول بسبب خطأ في الـ hook
  RETURN event;
END;
$$;

-- الصلاحيات المطلوبة للـ hook
GRANT  EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated;

-- ==========================================================================
-- 2. إصلاح RLS على user_roles — إضافة fallback لما الـ hook مش مفعّل
--
-- المشكلة: user_roles_admin_read تعتمد على app_metadata
-- لو الـ hook مش مفعّل → app_metadata فاضي → الأدمن مش بيشوف المستخدمين
--
-- الحل: policy إضافية تعتمد على user_metadata (يُعبّأ دايماً عند التسجيل)
-- ==========================================================================

-- حذف الـ fallback القديمة لو موجودة
DROP POLICY IF EXISTS "user_roles_admin_read_fallback" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_metadata_fallback"   ON public.user_roles;

-- Fallback policy — تشتغل لما app_metadata فاضي (الـ hook مش مفعّل)
-- تعتمد على user_metadata.role و user_metadata.school_id
-- اللي بتتحفظ في auth.users عند التسجيل
CREATE POLICY "user_roles_admin_read_fallback"
    ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (
      -- app_metadata فاضي والـ hook مش مفعّل → نرجع للـ user_metadata
      (
        (auth.jwt() -> 'app_metadata' ->> 'role') IS NULL
        AND (
          -- super admin من user_metadata
          COALESCE((auth.jwt() -> 'user_metadata' ->> 'is_super_admin')::boolean, false) = true
          OR
          -- admin يرى مدرسته
          (
            (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
            AND school_id = (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid
          )
        )
      )
    );

-- ==========================================================================
-- 3. تحديث AuthContext cache key لاحتواء full_name
--    (تُعبّأ تلقائياً في الـ JWT بعد هذه المايجريشن)
-- ==========================================================================

-- لا يوجد SQL مطلوب — التغيير في الكود فقط

-- ==========================================================================
-- 4. تأكد من وجود index على profiles.id (للـ hook query)
-- ==========================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_id_hook
    ON public.profiles (id)
    INCLUDE (full_name, phone);

-- ==========================================================================
-- 5. تحقق من الـ hook
-- ==========================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'custom_access_token_hook'
  ) THEN
    RAISE WARNING 'custom_access_token_hook not found — hook will not work';
  ELSE
    RAISE NOTICE 'custom_access_token_hook OK — remember to activate it in Supabase Dashboard';
    RAISE NOTICE 'Authentication → Hooks → Customize access token (JWT) claims';
    RAISE NOTICE '→ Postgres Function → public.custom_access_token_hook';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
