-- ==============================================================================
-- Migration: 20261018140100_fix_notifications_update_rls.sql
-- Purpose  : حل خطأ 403 عند تحديث is_read في جدول notifications
--            مع ضمان أن المستخدم يحدّث إشعاراته فقط دون تغيير user_id أو school_id
-- NOTE     : ملف اقتراح - لا يُطبّق إلا بعد موافقة المستخدم الصريحة
-- ==============================================================================

SET search_path TO public;

-- 1. إزالة السياسة القديمة غير المتوازنة بين USING و WITH CHECK
DROP POLICY IF EXISTS "notif_access" ON public.notifications;
DROP POLICY IF EXISTS "notif_select" ON public.notifications;
DROP POLICY IF EXISTS "notif_insert" ON public.notifications;
DROP POLICY IF EXISTS "notif_update" ON public.notifications;
DROP POLICY IF EXISTS "notif_delete" ON public.notifications;

-- 2. سياسة SELECT: قراءة إشعارات المستخدم الخاصة أو للأدمن في مدرسته
CREATE POLICY "notif_select" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    get_auth_is_super_admin()
    OR user_id = (SELECT auth.uid())
    OR (school_id = get_auth_school_id() AND get_auth_role() = 'admin')
  );

-- 3. سياسة INSERT: للمسؤولين فقط (أو الدوال النظامية SECURITY DEFINER)
CREATE POLICY "notif_insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    get_auth_is_super_admin()
    OR (school_id = get_auth_school_id() AND get_auth_role() = 'admin')
  );

-- 4. سياسة UPDATE: تسمح للمستخدم بتحديث إشعاراته (مثل is_read) بشرط بقاء user_id مساوياً لـ auth.uid()
CREATE POLICY "notif_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    get_auth_is_super_admin()
    OR user_id = (SELECT auth.uid())
    OR (school_id = get_auth_school_id() AND get_auth_role() = 'admin')
  )
  WITH CHECK (
    get_auth_is_super_admin()
    OR (
      user_id = (SELECT auth.uid()) 
      AND school_id = (SELECT get_auth_school_id())
    )
    OR (school_id = get_auth_school_id() AND get_auth_role() = 'admin')
  );

-- 5. سياسة DELETE: قصر الحذف على الإدارة والمدير العام
CREATE POLICY "notif_delete" ON public.notifications
  FOR DELETE TO authenticated
  USING (
    get_auth_is_super_admin()
    OR (school_id = get_auth_school_id() AND get_auth_role() = 'admin')
  );

-- 6. زناد (Trigger) لحماية عدم تعديل user_id و school_id نهائياً لأي مستخدم عادي
CREATE OR REPLACE FUNCTION public.trg_protect_notification_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (get_auth_is_super_admin() OR (get_auth_role() = 'admin')) THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'غير مصرح بتغيير صاحب الإشعار user_id';
    END IF;
    IF NEW.school_id IS DISTINCT FROM OLD.school_id THEN
      RAISE EXCEPTION 'غير مصرح بتغيير مدرسة الإشعار school_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_notification_columns ON public.notifications;
CREATE TRIGGER trg_protect_notification_columns
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_protect_notification_columns();

-- 7. إشعار PostgREST بتحديث الـ schema cache
NOTIFY pgrst, 'reload schema';
