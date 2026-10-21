-- ==============================================================================
-- Migration: 20261021200000_fix_security_linter_exposed_functions.sql
-- Purpose  : معالجة تحذيرات Supabase Database Linter (0011 / 0024 / 0028)
--
-- ── السبب الجذري (RCA) ───────────────────────────────────────────────────────
-- في Postgres يُمنح EXECUTE تلقائياً لدور PUBLIC عند إنشاء أي دالة جديدة.
-- المستخدمان anon و authenticated يَرِثان صلاحيات PUBLIC، لذلك:
--     REVOKE EXECUTE ON FUNCTION f FROM anon;   -- لا يكفي!
-- لأن المنحة الأصلية ما زالت قائمة لـ PUBLIC و anon يرثها منه.
-- الحل الصحيح: REVOKE EXECUTE ON FUNCTION f FROM PUBLIC;  (ثم المنح المقصود).
--
-- هذا ما يفسّر بقاء تحذيرات 0028 رغم ملفات الإصلاح السابقة
-- (مثل 20260903200000 التي سحبت من anon فقط دون PUBLIC).
--
-- ── ما يفعله هذا الملف ──────────────────────────────────────────────────────
--   1) سحب أسرار Vault (get_vault_secret) — service_role فقط.
--   2) سحب الدوال الحساسة (تُعيد بيانات أي معرّف) من PUBLIC و anon.
--   3) سحب دوال الـ Trigger الخالصة من الجميع (لا تُستدعى عبر RPC إطلاقاً).
--   4) تثبيت search_path على دالتين (تحذير 0011).
--   5) إغلاق سياسة INSERT المفتوحة على school_orders (تحذير 0024).
--
-- ── ما لا يغيّره عن قصد (تحذيرات 0028 مقبولة وضرورية) ──────────────────────
--   منح anon لهذه الدوال لازم لأن سياسات RLS تستدعيها أثناء التسجيل/الدخول
--   وقبل وجود session، وسحبها يعيد أخطاء 42501:
--     get_school_id_by_slug, has_role, get_user_role, get_my_role,
--     get_my_school_id, get_auth_role, get_auth_school_id,
--     get_auth_is_super_admin, is_school_admin(±), is_super_admin.
--
-- ملاحظة: idempotent وآمن — كل عملية مغلّفة بـ EXCEPTION فلا تتوقف عند غياب دالة.
-- ==============================================================================

SET search_path TO public;

-- ── 1) أسرار Vault: لا يقرأها إلا service_role ───────────────────────────────
DO $$
BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION public.get_vault_secret(text) FROM PUBLIC, anon, authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_vault_secret(text) TO service_role';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'skip get_vault_secret: %', SQLERRM;
END $$;

-- ── 2) دوال حساسة: سحب PUBLIC و anon — الإبقاء على authenticated ──────────────
--    كلها تُعيد بيانات حساسة لأي معرّف يُمرَّر، ولم يكن يفترض أن يصلها زائر.
DO $$
DECLARE
  sig TEXT;
  sensitive TEXT[] := ARRAY[
    'public.get_child_full_details(uuid, uuid)',
    'public.get_complete_user_data(uuid)',
    'public.get_exam_review_questions(uuid)',
    'public.get_parent_dashboard_summary(uuid, uuid)',
    'public.get_parent_electronic_exams(uuid, uuid)',
    'public.grant_exam_retake(uuid, uuid)',
    'public.get_database_row_counts()'
  ];
BEGIN
  FOREACH sig IN ARRAY sensitive LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', sig);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'skip %: %', sig, SQLERRM;
    END;
  END LOOP;
END $$;

-- ── 3) دوال Trigger خالصة: تُنفَّذ بصلاحيات المالك — لا حاجة لأي منح ──────────
--    (مؤكَّد من تعريفاتها: كلها تُستدعى عبر CREATE TRIGGER فقط)
DO $$
DECLARE
  sig TEXT;
  trigger_fns TEXT[] := ARRAY[
    'public.handle_new_user()',
    'public.normalize_student_name_trigger()',
    'public.notify_class_chat_message()',
    'public.notify_new_grade()',
    'public.notify_on_new_conversation_message()',
    'public.trigger_push_on_notification_insert()',
    'public.update_conversation_on_new_message()',
    'public.update_electronic_exam_updated_at()',
    'public.sync_parent_students_by_phone()',
    'public.sync_role_students_by_phone()',
    'public.sync_student_parent_by_phone()'
  ];
BEGIN
  FOREACH sig IN ARRAY trigger_fns LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', sig);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'skip %: %', sig, SQLERRM;
    END;
  END LOOP;
END $$;

-- ── 4) تثبيت search_path (تحذير 0011) ────────────────────────────────────────
DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION public.normalize_arabic_answer(text) SET search_path = public';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'skip normalize_arabic_answer search_path: %', SQLERRM;
END $$;

DO $$
BEGIN
  EXECUTE 'ALTER FUNCTION public.check_exam_answer_matches(text, text, text) SET search_path = public';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'skip check_exam_answer_matches search_path: %', SQLERRM;
END $$;

-- ── 5) إغلاق سياسة INSERT المفتوحة على school_orders (تحذير 0024) ────────────
--    السياسة الحيّة "so_insert" تسمح بأي صف (WITH CHECK = true).
--    نستبدلها بنفس قيد 20260831210000: طلب جديد بحالة pending فقط.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'school_orders'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "so_insert" ON public.school_orders';
    EXECUTE 'DROP POLICY IF EXISTS "school_orders_anon_insert_pending" ON public.school_orders';
    EXECUTE 'CREATE POLICY "school_orders_anon_insert_pending" ON public.school_orders
               FOR INSERT TO anon, authenticated
               WITH CHECK (status = ''pending'' OR status IS NULL)';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'skip school_orders policy: %', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';
