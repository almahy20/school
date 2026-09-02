-- ==========================================================================
-- Migration: 20260911100000_add_plain_password_to_profiles.sql
-- Purpose  : إضافة عمود plain_password لجدول profiles
--            ليتمكن المدير من رؤية كلمة مرور ولي الأمر التي أنشأها أو عدّلها
--
-- ملاحظة أمنية:
--   - العمود مرئي فقط للـ admin / super_admin عبر RLS
--   - ولي الأمر والمعلم لا يستطيعان قراءته أو كتابته
--   - يُملأ من Edge Function admin-users (SECURITY DEFINER أو service_role)
--   - لا يُملأ عند تسجيل ولي الأمر بنفسه (ParentSignupPage) — في هذه الحالة
--     الأدمن لا يعرف كلمة المرور فعلاً، ويبقى العمود NULL
-- ==========================================================================

SET search_path TO public;

-- 1. إضافة العمود
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plain_password TEXT;

-- 2. Policy للقراءة — admin / super_admin من نفس المدرسة فقط
DROP POLICY IF EXISTS "profiles_read_plain_password_admin" ON public.profiles;

CREATE POLICY "profiles_read_plain_password_admin"
  ON public.profiles
  FOR SELECT
  USING (
    -- المستخدم الحالي هو super_admin
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = (SELECT auth.uid())
        AND is_super_admin = TRUE
    )
    OR
    -- المستخدم الحالي admin من نفس المدرسة
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id    = (SELECT auth.uid())
        AND ur.role       = 'admin'
        AND ur.school_id  = profiles.school_id
    )
  );

-- 3. Policy للكتابة — service_role فقط (Edge Function تكتب بهذا السياق)
--    المستخدمون العاديون لا يستطيعون تغيير plain_password مباشرة
REVOKE UPDATE (plain_password) ON public.profiles FROM authenticated, anon;
GRANT  UPDATE (plain_password) ON public.profiles TO service_role;

NOTIFY pgrst, 'reload schema';
