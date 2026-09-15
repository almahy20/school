-- ==========================================================================
-- Migration : 20260915120000_fix_rpc_and_extensions.sql
-- السبب     : إصلاح 3 مشاكل حرجة ظهرت في التشخيص:
--             1. schema "net" does not exist (129 خطأ) -> تحتاج pg_net extension
--             2. function extensions.http_post(...) does not exist (2 خطأ) -> الحل باستخدام pg_net فقط (http extension غير مدعوم في بعض بيئات Supabase)
--             3. RPC functions get_user_role و has_role و is_super_admin مفقودة -> مستخدمة في 30+ RLS Policy
-- ==========================================================================

SET search_path TO public;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. تفعيل الـ Extensions اللازمة لإرسال الإشعارات الفورية               ║
-- ║    ملاحظة: نستخدم pg_net فقط لأن http extension غير متاح في بعض البيئات ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── التأكد من وجود schema net و wrapper لـ http_post ────────────────────────
-- (لأن pg_net أحياناً يُثبّت في schema آخر مثل extensions)
DO $$
DECLARE
  v_schema        text;
  v_arg_types     text[];
  v_arg_types_str text;
  r               record;
BEGIN
  -- 1. ابحث عن أي schema يحتوي على دالة http_post
  SELECT ns.nspname INTO v_schema
  FROM pg_proc p
  JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE p.proname = 'http_post'
  LIMIT 1;

  IF v_schema IS NULL THEN
    RAISE WARNING '⚠️  لم أجد دالة http_post في أي schema — تحقق من تفعيل pg_net';
  ELSE
    RAISE NOTICE '✅ pg_net موجود في schema: %.', v_schema;

    -- 2. التأكد من وجود schema net (لأن الـ triggers تتوقع net.http_post)
    EXECUTE 'CREATE SCHEMA IF NOT EXISTS net';

    -- 3. إذا كان pg_net موجود في schema مختلف عن net → أنشئ wrapper
    IF v_schema <> 'net' THEN
      RAISE NOTICE '   ℹ️  الـ triggers تتوقع net.http_post، و pg_net موجود في %. إنشاء wrapper...', v_schema;

      -- نبحث عن توقيع واحد لـ http_post لنستخدمه في الـ wrapper
      SELECT array_agg(pg_catalog.format_type(p.proargtypes[i], null))
        INTO v_arg_types
      FROM pg_proc p
      JOIN pg_namespace ns ON ns.oid = p.pronamespace
      JOIN generate_subscripts(p.proargtypes, 1) i ON true
      WHERE ns.nspname = v_schema AND p.proname = 'http_post'
      GROUP BY p.oid
      LIMIT 1;

      IF v_arg_types IS NOT NULL AND array_length(v_arg_types, 1) > 0 THEN
        v_arg_types_str := array_to_string(v_arg_types, ', ');

        DROP FUNCTION IF EXISTS net.http_post(text, jsonb, jsonb, integer);
        DROP FUNCTION IF EXISTS net.http_post(text, jsonb, jsonb, int);
        DROP FUNCTION IF EXISTS net.http_post(text, jsonb, jsonb);

        EXECUTE format(
          'CREATE OR REPLACE FUNCTION net.http_post(%s) RETURNS bigint
             LANGUAGE plpgsql
             SECURITY DEFINER
             SET search_path = public
           AS $w$
           DECLARE r bigint;
           BEGIN
             SELECT INTO r %I.http_post(%s);
             RETURN r;
           END $w$;',
          v_arg_types_str, v_schema,
          array_to_string(ARRAY(SELECT '$' || g FROM generate_series(1, array_length(v_arg_types, 1)) g), ', ')
        );

        EXECUTE format('GRANT EXECUTE ON FUNCTION net.http_post(%s) TO anon, authenticated, service_role, supabase_admin', v_arg_types_str);
        RAISE NOTICE '   ✅ تم إنشاء wrapper: net.http_post(%) → %.http_post(%)', v_arg_types_str, v_schema, v_arg_types_str;
      ELSE
        RAISE WARNING '   ⚠️  لم أجد توقيع http_post صالحاً لإنشاء wrapper';
      END IF;
    END IF;

    -- 4. منح صلاحيات استخدام الـ schema الأصلي للـ pg_net
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO supabase_admin, authenticated', v_schema);
    EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA %I TO supabase_admin, authenticated, service_role', v_schema);
  END IF;
END $$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. إنشاء enum app_role لو مش موجود (مستخدم في الدوال و Policies)       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'parent', 'super_admin');
    RAISE NOTICE '✅ تم إنشاء enum public.app_role';
  ELSE
    RAISE NOTICE 'ℹ️ enum public.app_role موجود أصلاً';
  END IF;
END $$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. إعادة إنشاء دالة has_role (المستخدمة في 30+ RLS Policy)             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role TEXT)
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
      AND role::text = _role::text
  );
$$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. إعادة إنشاء دالة get_user_role                                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1;
$$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. إعادة إنشاء دالة is_super_admin (مستخدمة في RLS Policies كثيرة)     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_sa BOOLEAN;
BEGIN
  SELECT is_super_admin INTO is_sa
  FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;

  RETURN COALESCE(is_sa, false);
END;
$$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 6. منح الصلاحيات للـ authenticated (لازم عشان REST API يشوفها)          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, anon, service_role;

-- منح صلاحيات استخدام pg_net للـ Trigger
GRANT USAGE ON SCHEMA net TO supabase_admin;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO supabase_admin, authenticated;

-- إعادة تحميل الـ Schema عشان PostgREST يقرا الـ Functions الجديدة
NOTIFY pgrst, 'reload schema';

-- ==========================================================================
-- نهاية الإصلاح.
-- يمكن تطبيق هذا الملف على قاعدة بيانات بها بيانات بكل أمان (كلها IF NOT EXISTS).
-- بعد التطبيق: الإشعارات مش هتعمل errors بعد، وكل الـ RLS Policies هتشتغل.
-- ==========================================================================
