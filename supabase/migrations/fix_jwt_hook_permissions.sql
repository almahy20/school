-- ════════════════════════════════════════════════════════════════════════
-- Fix: custom_access_token_hook — الصلاحيات المفقودة
--
-- الخطأ الظاهر عند تفعيل الـ hook من Supabase Dashboard:
--   Error running hook URI: pg-functions://postgres/public/custom_access_token_hook
--
-- السبب الجذري:
--   الـ hook يُستدعى من قبل الدور supabase_auth_admin، وهذا الدور يحتاج:
--     1) USAGE على المخطط public  ← مفقود، فلا يستطيع الوصول للدالة أصلاً
--     2) EXECUTE على الدالة        ← يُفقد إذا لم يُمنح صراحةً بعد REVOKE من PUBLIC
--     3) SELECT على الجداول التي تقرأها الدالة (user_roles / profiles)
--
-- أي فشل في الاستدعاء (صلاحية/دالة مفقودة) يظهر في Dashboard كخطأ الـ hook،
-- لأن الاستثناء يُرفع قبل الدخول إلى جسم الدالة (خارج بلوك EXCEPTION).
--
-- ملاحظة: هذا الملف idempotent — يمكن تشغيله أكثر من مرة بأمان.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1) إعادة بناء الدالة (يعمل أيضاً لو كانت غير موجودة على السيرفر) ──────
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

  -- جلب الدور مع أولوية: super_admin ثم admin ثم teacher ثم parent
  SELECT ur.school_id, ur.role, ur.is_super_admin, ur.approval_status
  INTO   v_school_id, v_role, v_is_super, v_approval
  FROM   public.user_roles ur
  WHERE  ur.user_id = user_id
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

-- ── 2) الصلاحيات — جوهر الإصلاح ─────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated;

-- تمكين الـ hook من قراءة الجداول التي يحتاجها
GRANT SELECT ON public.user_roles TO supabase_auth_admin;
GRANT SELECT ON public.profiles   TO supabase_auth_admin;

-- ── 3) تحقق ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'custom_access_token_hook'
  ) THEN
    RAISE NOTICE 'custom_access_token_hook موجود — تم تحديث صلاحيات supabase_auth_admin';
  ELSE
    RAISE WARNING 'custom_access_token_hook غير موجود — فشل إنشاء الدالة';
  END IF;

  IF has_schema_privilege('supabase_auth_admin', 'public', 'USAGE') THEN
    RAISE NOTICE 'supabase_auth_admin لديه USAGE على public';
  ELSE
    RAISE WARNING 'supabase_auth_admin يفتقد USAGE على public';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
