-- ==========================================================================
-- Migration: 20260911100000_add_plain_password_to_profiles.sql
-- ⚠️  تم إيقاف هذا التحديث لأسباب أمنية حرجة:
--     تخزين كلمات المرور كنص واضح أمر غير مسموح به أبداً.
-- بدلاً من إضافة العمود، هذا الملف الآن يحذفه نهائياً لو كان موجوداً.
-- يمكنك حذف هذا الملف بالكامل لاحقاً بعد التأكد من إزالة العمود.
-- ==========================================================================

SET search_path TO public;

-- إزالة عمود plain_password من profiles لو موجود
DO $
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'plain_password'
  ) THEN
    ALTER TABLE public.profiles DROP COLUMN plain_password;
  END IF;
END $;

-- إزالة الـ Policies المرتبطة لو موجودة
DROP POLICY IF EXISTS "profiles_read_plain_password_admin" ON public.profiles;

NOTIFY pgrst, 'reload schema';
