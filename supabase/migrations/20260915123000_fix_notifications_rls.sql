-- ==========================================================================
-- Migration : 20260915123000_fix_notifications_rls.sql
-- السبب     : إصلاح permission denied على جدول notification_delivery_logs
--             وتنظيف الأخطاء القديمة في جداول push
-- ==========================================================================

SET search_path TO public;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 0. التأكد من وجود دالة is_super قبل إنشاء الـ Policies                  ║
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

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, anon, service_role;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. التأكد من تفعيل RLS على كل جداول الإشعارات                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

DO $$
DECLARE
  t                text;
  v_cnt            integer;
  v_has_school_id  boolean;
  v_has_notif_id   boolean;
  v_admin_using    text;
  v_notif_has_sid  boolean;
  tables text[] := ARRAY[
    'notification_delivery_logs',
    'push_delivery_log',
    'push_subscriptions',
    'push_trigger_errors',
    'notification_preferences'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    SELECT COUNT(*) INTO v_cnt
    FROM information_schema.tables
    WHERE table_schema='public' AND table_name=t;

    IF v_cnt > 0 THEN
      EXECUTE 'ALTER TABLE public.' || quote_ident(t) || ' ENABLE ROW LEVEL SECURITY';

      -- ── 1) Super Admin Policy ──────────────────────────────────────────
      EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(t || '_super_admin_full') || ' ON public.' || quote_ident(t);
      EXECUTE 'CREATE POLICY ' || quote_ident(t || '_super_admin_full') || ' ON public.' || quote_ident(t)
           || ' FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin())';

      -- ── 2) فحص وجود أعمدة school_id / notification_id في الجدول ────────
      SELECT COUNT(*) INTO v_cnt
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='school_id';
      v_has_school_id := (v_cnt > 0);

      SELECT COUNT(*) INTO v_cnt
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='notification_id';
      v_has_notif_id := (v_cnt > 0);

      -- ── 3) فحص وجود school_id في جدول notifications ────────────────────
      SELECT COUNT(*) INTO v_cnt
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='notifications' AND column_name='school_id';
      v_notif_has_sid := (v_cnt > 0);

      -- ── 4) بناء شرط الـ Policy للـ Admin ────────────────────────────────
      IF v_has_school_id THEN
        v_admin_using := 'public.has_role(auth.uid(), ''admin'') AND school_id IN (SELECT school_id FROM public.user_roles WHERE user_id = auth.uid())';
      ELSIF v_has_notif_id AND v_notif_has_sid THEN
        v_admin_using := 'public.has_role(auth.uid(), ''admin'') AND EXISTS (SELECT 1 FROM public.notifications n JOIN public.user_roles ur ON ur.user_id = auth.uid() WHERE n.id = ' || quote_ident(t) || '.notification_id AND n.school_id = ur.school_id)';
      ELSE
        v_admin_using := NULL;
      END IF;

      -- ── 5) إنشاء Policy Admin إن أمكن ──────────────────────────────────
      IF v_admin_using IS NOT NULL THEN
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(t || '_admin_school') || ' ON public.' || quote_ident(t);
        EXECUTE 'CREATE POLICY ' || quote_ident(t || '_admin_school') || ' ON public.' || quote_ident(t)
             || ' FOR SELECT TO authenticated USING (' || v_admin_using || ')';
        RAISE NOTICE '✅ Policies (Super Admin + Admin) تم إنشاؤها لـ %', t;
      ELSE
        RAISE NOTICE '⚠️  جدول % ليس فيه school_id ولا notification_id — تم تخطي Policy Admin (فقط Super Admin Policy مطبّق)', t;
      END IF;

    ELSE
      RAISE NOTICE 'ℹ️ جدول % غير موجود — تخطي', t;
    END IF;
  END LOOP;
END $$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. منح صلاحيات استخدام الجداول (مطلوب عشان الجداول تكون متاحة)          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. إصلاح سلامة البيانات و integrity constraints                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── 3.1 إضافة عمود created_at المفقود في notification_delivery_logs ────────
ALTER TABLE public.notification_delivery_logs
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ── 3.2 تنظيف orphan rows في push_trigger_errors قبل إضافة الـ FK ──────────
--     (سجلات أخطاء تشير إلى إشعارات محذوفة)
DO $$
DECLARE
  v_cnt   integer;
  v_tbl   integer;
  v_col   integer;
BEGIN
  SELECT COUNT(*) INTO v_tbl FROM information_schema.tables
  WHERE table_schema='public' AND table_name='push_trigger_errors';

  IF v_tbl > 0 THEN
    SELECT COUNT(*) INTO v_col FROM information_schema.columns
    WHERE table_schema='public' AND table_name='push_trigger_errors' AND column_name='notification_id';

    IF v_col > 0 THEN
      -- 1) عدّ الصفوف التالفة أولاً للعلم (تظهر في الـ NOTICE)
      EXECUTE $q$
        SELECT COUNT(*)
        FROM public.push_trigger_errors e
        WHERE e.notification_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.id = e.notification_id)
      $q$ INTO v_cnt;

      IF v_cnt > 0 THEN
        RAISE NOTICE '⚠️  تم اكتشاف % orphan row(s) في push_trigger_errors (تشير إلى إشعارات محذوفة) — سيتم تحويل notification_id إلى NULL بدلاً من حذفها (لحفظ سجل الأخطاء).', v_cnt;

        -- 2) تحويل الـ IDs المفقودة إلى NULL بدلاً من حذف الصفوف
        --    (يفضل الإبقاء على سجل الخطأ حتى لو الإشعار محذوف)
        EXECUTE $q$
          UPDATE public.push_trigger_errors e
          SET notification_id = NULL
          WHERE e.notification_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.id = e.notification_id)
        $q$;
        GET DIAGNOSTICS v_cnt = ROW_COUNT;
        RAISE NOTICE '✅ تم تنظيف % orphan row(s) بنجاح.', v_cnt;
      ELSE
        RAISE NOTICE 'ℹ️  لا توجد orphan rows في push_trigger_errors.';
      END IF;

      -- 3) الآن نضيف الـ Foreign Key constraint بعد تطهير البيانات
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'push_trigger_errors_notification_id_fkey'
      ) THEN
        ALTER TABLE public.push_trigger_errors
          ADD CONSTRAINT push_trigger_errors_notification_id_fkey
          FOREIGN KEY (notification_id)
          REFERENCES public.notifications(id)
          ON DELETE SET NULL;
        RAISE NOTICE '✅ تم إضافة FK constraint: push_trigger_errors_notification_id_fkey';
      ELSE
        RAISE NOTICE 'ℹ️  FK constraint push_trigger_errors_notification_id_fkey موجود أصلاً.';
      END IF;
    END IF;
  END IF;
END $$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. إصلاح عدم اتساق Foreign Key في جدول grades (teacher_id)              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- ملاحظة: باقي جداول النظام (electronic_exams, classes, exam_templates, teacher_attendance)
--         كلها بتشير ب teacher_id إلى public.profiles.id — بس grades كانت تشير خطأ إلى
--         auth.users.id. هنصلحها هنا مع فحص سلامة البيانات قبل أي تعديل طبقاً لقواعد المشروع.
DO $$
DECLARE
  v_missing integer;
  v_tbl     integer;
  v_col     integer;
BEGIN
  SELECT COUNT(*) INTO v_tbl FROM information_schema.tables
  WHERE table_schema='public' AND table_name='grades';

  IF v_tbl > 0 THEN
    SELECT COUNT(*) INTO v_col FROM information_schema.columns
    WHERE table_schema='public' AND table_name='grades' AND column_name='teacher_id';

    IF v_col > 0 THEN
      -- 1) فحص أولاً هل هناك teacher IDs في grades مش موجودة أصلاً في public.profiles؟
      --    (قاعدة المشروع: نَفحَص البيانات وَنَقْرأَها قبل أي حذف أو تعديل على أعمدة)
      SELECT COUNT(*) INTO v_missing
      FROM public.grades g
      WHERE g.teacher_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = g.teacher_id);

      IF v_missing > 0 THEN
        RAISE NOTICE '⚠️  تم اكتشاف % row(s) في grades بدهم teacher_id غير موجود في public.profiles — سيتم تحويلهم إلى NULL لحفظ سلامة الـ FK وعدم فقدان سجل الدرجات.', v_missing;

        -- تحويل الأرقام المفقودة إلى NULL بدلاً من حذف أي صفوف
        UPDATE public.grades g
        SET teacher_id = NULL
        WHERE g.teacher_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = g.teacher_id);
        GET DIAGNOSTICS v_missing = ROW_COUNT;
        RAISE NOTICE '✅ تم تحويل teacher_id لـ % row(s) بنجاح.', v_missing;
      ELSE
        RAISE NOTICE 'ℹ️  كل teacher_id الموجود في grades موجود أصلاً في public.profiles.';
      END IF;

      -- 2) إزالة الـ Foreign Key القديم الخاطئ (لو موجود) اللي كان بيشير إلى auth.users
      IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'grades_teacher_id_fkey'
      ) THEN
        ALTER TABLE public.grades DROP CONSTRAINT grades_teacher_id_fkey;
        RAISE NOTICE '✅ تم حذف FK القديم الخاطئ grades_teacher_id_fkey (اللي كان بيشير إلى auth.users).';
      ELSE
        RAISE NOTICE 'ℹ️  FK القديم grades_teacher_id_fkey مش موجود أصلاً.';
      END IF;

      -- 3) إنشاء الـ Foreign Key الجديد الصحيح بيشير إلى public.profiles.id
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'grades_teacher_id_fkey'
      ) THEN
        ALTER TABLE public.grades
          ADD CONSTRAINT grades_teacher_id_fkey
          FOREIGN KEY (teacher_id)
          REFERENCES public.profiles(id)
          ON DELETE SET NULL;
        RAISE NOTICE '✅ تم إنشاء FK الجديد الصحيح grades_teacher_id_fkey → public.profiles(id).';
      END IF;
    END IF;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- ==========================================================================
-- نهاية الإصلاحات الشاملة (قسم 1 → 4):
--   1. is_super_admin function + صلاحياتها
--   2. RLS Policies ديناميكية لجداول الإشعارات و Push logs
--   3. سلامة البيانات: created_at + تنظيف orphan rows + FK push_trigger_errors
--   4. إصلاح عدم اتساق FK بتاع grades.teacher_id
-- ==========================================================================
