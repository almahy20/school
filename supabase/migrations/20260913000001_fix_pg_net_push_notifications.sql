-- ============================================================
-- إعداد pg_net للإشعارات الفورية - بدون افتراض توقيع الدالة
-- ============================================================

-- منح صلاحيات على extensions (هو موجود دائماً مع pg_trgm و pgcrypto)
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

DO $$
DECLARE
  v_schema            NAME;
  v_oid               OID;
  v_arg_types         OID[];
  v_arg_types_str     TEXT;
  v_found             BOOLEAN := FALSE;
  r                   RECORD;
BEGIN
  -- 1. هل الامتداد مثبت؟
  SELECT n.nspname, e.oid INTO v_schema, v_oid
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pg_net';

  IF NOT FOUND THEN
    RAISE NOTICE '➡️  pg_net غير مثبت. يحتاج تفعيل يدوياً: Dashboard → Database → Extensions → pg_net → Enable';
    RAISE NOTICE '   رابط لوحة التحكم: https://supabase.com/dashboard/project/mecutwhreywjwstirpka/database/extensions';
  ELSE
    RAISE NOTICE '✅ pg_net مثبت حالياً في schema: %', v_schema;
    v_found := TRUE;

    -- منح صلاحيات على الـ schema
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO anon, authenticated, service_role', v_schema);

    -- 2. البحث عن أي دالة اسمها http_post في هذا الـ schema (بدون افتراض التوقيع)
    FOR r IN
      SELECT p.proname, p.oid, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace ns ON ns.oid = p.pronamespace
      WHERE ns.nspname = v_schema AND p.proname = 'http_post'
    LOOP
      -- منح التنفيذ على كل دالة http_post موجودة بكل توقيع
      EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO anon, authenticated, service_role',
                     v_schema, r.proname, r.args);
      RAISE NOTICE '   ✅ منح EXECUTE لـ %.%(%)', v_schema, r.proname, r.args;
    END LOOP;

    -- 3. إذا لم يكن في schema net → ننشئ Schema net + wrapper للدالة
    IF v_schema <> 'net' THEN
      RAISE NOTICE '   ℹ️  الـ triggers تتوقع net.http_post، و pg_net موجود في %. إنشاء wrapper...', v_schema;

      -- ننشئ schema net إذا لم يكن موجوداً
      IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'net') THEN
        CREATE SCHEMA net AUTHORIZATION postgres;
      END IF;
      GRANT USAGE ON SCHEMA net TO anon, authenticated, service_role;

      -- الآن نبحث عن توقيع واحد لـ http_post لنستخدمه في الـ wrapper
      SELECT pg_get_function_identity_arguments(p.oid) AS args INTO v_arg_types_str
      FROM pg_proc p
      JOIN pg_namespace ns ON ns.oid = p.pronamespace
      WHERE ns.nspname = v_schema AND p.proname = 'http_post'
      ORDER BY array_length(p.proargtypes, 1) DESC
      LIMIT 1;

      IF FOUND AND v_arg_types_str IS NOT NULL THEN
        -- ندمر الـ wrapper القديم إن وجد
        DROP FUNCTION IF EXISTS net.http_post(text, jsonb, jsonb, integer);
        DROP FUNCTION IF EXISTS net.http_post(text, jsonb, jsonb, int);
        DROP FUNCTION IF EXISTS net.http_post(text, jsonb, jsonb);

        -- ننشئ wrapper ديناميكي يطابق التوقيع الحقيقي (نستخدم أكبر عدد باراميترات)
        EXECUTE format(
          'CREATE OR REPLACE FUNCTION net.http_post(%s) RETURNS bigint
             LANGUAGE plpgsql SECURITY DEFINER
             SET search_path = public
           AS $wrap$
           DECLARE r bigint;
           BEGIN
             SELECT INTO r %I.http_post(%s);
             RETURN r;
           END;
           $wrap$;',
          v_arg_types_str, v_schema,
          (SELECT string_agg('$' || ordinality::text, ', ')
           FROM unnest(string_to_array(v_arg_types_str, ','))
           WITH ORDINALITY AS t(t, ordinality))
        );

        EXECUTE format('GRANT EXECUTE ON FUNCTION net.http_post(%s) TO anon, authenticated, service_role', v_arg_types_str);
        RAISE NOTICE '   ✅ تم إنشاء wrapper: net.http_post(%) → %.http_post(%)', v_arg_types_str, v_schema, v_arg_types_str;
      ELSE
        RAISE WARNING '   ⚠️  لم أجد توقيع http_post صالحاً لإنشاء wrapper';
      END IF;
    ELSE
      RAISE NOTICE '   ✅ pg_net مثبت في schema net مباشرة، لا حاجة للـ wrapper';
    END IF;
  END IF;
END $$;
