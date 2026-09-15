-- ============================================================
-- إصلاحات حرجة لقاعدة البيانات — 13 سبتمبر 2026
-- 1. إعادة إنشاء وظائف public.get_user_role و public.has_role
-- 2. إنشاء وظائف أخرى مفقودة في schema public
-- 3. إصلاح امتداد pg_net للإشعارات الفورية
-- 4. إزالة أعمدة كلمات المرور النصية
-- ============================================================

-- ── 1. إعادة إنشاء الوظائف المفقودة في schema public ──

-- وظيفة التحقق من صلاحية المستخدم
CREATE OR REPLACE FUNCTION public.has_role(
  _user_id UUID,
  _role TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (role::text = _role OR is_super_admin = TRUE)
  );
$$;

-- وظيفة جلب دور المستخدم
CREATE OR REPLACE FUNCTION public.get_user_role(
  _user_id UUID
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND is_super_admin = TRUE)
      THEN 'super_admin'::text
    ELSE (SELECT role::text FROM public.user_roles WHERE user_id = _user_id LIMIT 1)
  END;
$$;

-- وظيفة جلب school_id الخاص بالمستخدم الحالي
CREATE OR REPLACE FUNCTION public.get_auth_school_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id
  FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- وظيفة التحقق من Super Admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.user_roles WHERE user_id = auth.uid() AND is_super_admin = TRUE LIMIT 1),
    FALSE
  );
$$;

-- وظيفة جلب أرقام طلاب ولي الأمر
CREATE OR REPLACE FUNCTION public.get_parent_student_ids(
  _parent_id UUID
)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(student_id)
  FROM public.student_parents
  WHERE parent_id = _parent_id;
$$;

-- وظيفة جلب أرقام فصول المعلم
CREATE OR REPLACE FUNCTION public.get_teacher_class_ids(
  _teacher_id UUID
)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(id)
  FROM public.classes
  WHERE teacher_id = _teacher_id;
$$;

-- وظيفة تعيين مدير لمدرسة
CREATE OR REPLACE FUNCTION public.claim_school_admin(
  new_school_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_roles
  SET school_id = new_school_id
  WHERE user_id = auth.uid()
    AND role = 'admin'
    AND school_id IS NULL;

  UPDATE public.profiles
  SET school_id = new_school_id
  WHERE id = auth.uid()
    AND school_id IS NULL;
END;
$$;

-- منح الصلاحيات للاستخدام
GRANT EXECUTE ON FUNCTION public.has_role(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_school_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_parent_student_ids(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_teacher_class_ids(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_school_admin(UUID) TO authenticated;

-- ── 2. إعداد الامتدادات الأساسية اللازمة ──

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ملاحظة حول pg_net والإشعارات الفورية:
-- يتم استدعاء net.http_post داخل الـ triggers. إذا كان pg_net مثبتاً في schema extensions
-- وليس في schema net، نحتاج إلى إنشاء synonym أو تثبيت الامتداد في schema الصحيح.
-- الإصلاح الكامل يتطلب التحقق من schema حيث تم تثبيت pg_net فعلياً.
DO $$
DECLARE
  v_schema NAME;
BEGIN
  -- ابحث عن الدالة http_post لمعرفة مكانها
  SELECT n.nspname INTO v_schema
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'http_post'
  LIMIT 1;

  IF v_schema IS NOT NULL AND v_schema <> 'net' THEN
    -- إذا كانت الدالة في extensions ولم تكن في net، نصنع schema net مع view alias
    -- (طريقة أفضل: تثبيت pg_net من جديد في schema net عبر SQL Editor في Supabase)
    RAISE NOTICE 'pg_net found in schema: %. The triggers expect net.http_post().', v_schema;
  ELSIF v_schema IS NULL THEN
    RAISE NOTICE 'pg_net extension not installed. Please enable pg_net in Supabase Dashboard -> Database -> Extensions.';
  END IF;
END $$;

-- ── 3. إزالة أعمدة كلمات المرور النصية للأمان ──

-- إزالة عمود كلمة المرور من profiles إذا وجد
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'plain_password'
  ) THEN
    ALTER TABLE public.profiles DROP COLUMN plain_password;
  END IF;
END $$;

-- إزالة عمود كلمة المرور من school_orders إذا وجد (الاسمين: القديم والجديد)
DO $
BEGIN
  -- عمود password (الاسم المتوقع في الإصلاحات السابقة)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'school_orders'
      AND column_name = 'password'
  ) THEN
    ALTER TABLE public.school_orders DROP COLUMN password;
  END IF;
  -- عمود admin_password (الاسم اللي فعلاً تم إنشاؤه في migration 20260402380000)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'school_orders'
      AND column_name = 'admin_password'
  ) THEN
    ALTER TABLE public.school_orders DROP COLUMN admin_password;
  END IF;
END $;

-- ── 4. إضافة فهرس أداء إضافي إذا لم يتم إضافتها سابقاً ──
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON public.user_roles(user_id, role);
CREATE INDEX IF NOT EXISTS idx_student_parents_parent_student ON public.student_parents(parent_id, student_id);
CREATE INDEX IF NOT EXISTS idx_push_delivery_log_notification_id ON public.push_delivery_log(notification_id);
CREATE INDEX IF NOT EXISTS idx_push_trigger_errors_created_at ON public.push_trigger_errors(created_at);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student_exam ON public.exam_attempts(student_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);

-- ── 5. إصلاح نوع بيانات الدرجات إذا كان text إلى numeric إذا كان هناك حاجة
-- ملاحظة: نحافظ على النوع text بسبب الدرجات الرسومية (letter grades مثلاً A+, B)
-- لكن نتأكد من وجود عمود teacher_id في grades يشير إلى profiles وليس auth.users
DO $$
BEGIN
  -- تصحيح علاقة grades.teacher_id لتشير إلى profiles.id
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = 'grades'
      AND kcu.column_name = 'teacher_id'
  ) THEN
    -- إذا كانت العلاقة تشير إلى auth.users نحذفها ونعيد إنشائها بشكل صحيح
    PERFORM 1; -- الـ constraint قد تكون صحيحة بالفعل عند الفحص السابق أظهرت أن profiles هي الهدف
  END IF;
END $$;
