-- ==============================================================================
-- Migration: 20261021220000_fix_performance_linter_warnings.sql
-- Purpose  : معالجة تحذيرات الأداء في Supabase Database Linter
--
--   (أ) auth_rls_initplan (0003) × 14
--       سياسات RLS تستدعي auth.uid() مباشرة → تُعاد تقييمها لكل صف.
--       الإصلاح: لفّها داخل استعلام فرعي (select auth.uid()) فيتحوّل إلى InitPlan
--       يُقيَّم مرة واحدة لكل استعلام بدل مرة لكل صف.
--       ملاحظة: نقرأ التعبير الحالي من pg_policies ونلفّ الاستدعاء فقط —
--       بلا أي تغيير في منطق السياسة (بعض السياسات أُنشئت من لوحة Supabase
--       ولا يوجد لها تعريف في ملفات الهجرة).
--
--   (ب) multiple_permissive_policies (0006) × 11
--       وجود سياسة FOR ALL بجانب سياسات مخصّصة لنفس الدور والفعل → تُقيَّم جميعها
--       ويُدمج ناتجها بـ OR. الإصلاح: إزالة التكرار بتفكيك سياسة الـ ALL إلى
--       INSERT/UPDATE/DELETE منفصلة (أو حذفها إن كانت مُغطّاة بالفعل).
--
--   (ج) duplicate_index (0009) × 4
--       فهارس متطابقة تماماً → نحذف واحداً من كل زوج.
--
-- ملاحظة: idempotent — كل عملية مغلّفة فلا تتوقف عند غياب كائن.
-- ==============================================================================

SET search_path TO public;

-- ═════════════════════════════════════════════════════════════════════════════
-- (أ) إصلاح auth_rls_initplan — لفّ دوال auth داخل استعلام فرعي
-- ═════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  rec   RECORD;
  q     TEXT;
  c     TEXT;
  stmt  TEXT;
BEGIN
  FOR rec IN
    SELECT tablename, policyname, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (tablename, policyname) IN (
        ('notifications',         'notifications_select_policy'),
        ('notifications',         'notifications_update_policy'),
        ('notifications',         'notifications_insert_policy'),
        ('notifications',         'notifications_delete_policy'),
        ('push_subscriptions',    'push_subscriptions_user_access'),
        ('classes',               'classes_school_access'),
        ('students',              'students_select_unified'),
        ('profiles',              'profiles_select_unified'),
        ('user_roles',            'user_roles_select_unified'),
        ('student_parents',       'student_parents_access'),
        ('exam_retake_grants',    'exam_retake_grants_parent_select'),
        ('exam_attempt_drafts',   'exam_attempt_drafts_owner'),
        ('exam_questions',        'exam_questions_select_unified'),
        ('electronic_exams',      'electronic_exams_select_unified')
      )
  LOOP
    q := rec.qual;
    c := rec.with_check;

    -- خطوتان بلا lookbehind (لضمان العمل على كل إصدارات PostgreSQL):
    --   1) لفّ كل استدعاء مباشر auth.fn() داخل (select auth.fn())
    --   2) إصلاح أي لفّ مزدوج نتج عن استدعاء كان ملفوفاً أصلاً
    --      مثل (SELECT auth.role()) → (select (select auth.role())) ← يُعاد إلى (select auth.role())
    IF q IS NOT NULL THEN
      q := regexp_replace(q, 'auth\.(uid|role|jwt|email)\(\)', '(select auth.\1())', 'gi');
      q := regexp_replace(q, '\(\s*select\s+\(\s*select\s+auth\.(uid|role|jwt|email)\(\)\s*\)\s*\)', '(select auth.\1())', 'gi');
    END IF;
    IF c IS NOT NULL THEN
      c := regexp_replace(c, 'auth\.(uid|role|jwt|email)\(\)', '(select auth.\1())', 'gi');
      c := regexp_replace(c, '\(\s*select\s+\(\s*select\s+auth\.(uid|role|jwt|email)\(\)\s*\)\s*\)', '(select auth.\1())', 'gi');
    END IF;

    IF q IS NOT DISTINCT FROM rec.qual AND c IS NOT DISTINCT FROM rec.with_check THEN
      CONTINUE;  -- لا تغيير
    END IF;

    -- نُثبّت الأدوار صراحةً حتى لا يُفقد أي دور عند التعديل
    stmt := format('ALTER POLICY %I ON public.%I', rec.policyname, rec.tablename);
    IF rec.roles IS NOT NULL AND array_length(rec.roles, 1) > 0 THEN
      stmt := stmt || format(' TO %s', array_to_string(rec.roles, ', '));
    END IF;
    IF q IS NOT NULL THEN
      stmt := stmt || format(' USING (%s)', q);
    END IF;
    IF c IS NOT NULL THEN
      stmt := stmt || format(' WITH CHECK (%s)', c);
    END IF;

    BEGIN
      EXECUTE stmt;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'initplan skip %.%: %', rec.tablename, rec.policyname, SQLERRM;
    END;
  END LOOP;
END $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- (ب) إصلاح multiple_permissive_policies — تفكيك/حذف السياسات المتداخلة
-- ═════════════════════════════════════════════════════════════════════════════

-- ── ب-1) students: students_write_unified (FOR ALL) تتداخل مع
--        select/insert/update/delete_unified. نحذفها ونعيد بناء سياسات
--        الكتابة بالشروط الثلاثة كاملة (بما فيها is_school_admin). ────────────
DROP POLICY IF EXISTS "students_write_unified"   ON public.students;
DROP POLICY IF EXISTS "students_insert_unified"  ON public.students;
DROP POLICY IF EXISTS "students_update_unified"  ON public.students;
DROP POLICY IF EXISTS "students_delete_unified"  ON public.students;

CREATE POLICY "students_insert_unified" ON public.students
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin() OR is_school_admin(school_id) OR school_id = get_auth_school_id()
  );

CREATE POLICY "students_update_unified" ON public.students
  FOR UPDATE TO authenticated
  USING (
    is_super_admin() OR is_school_admin(school_id) OR school_id = get_auth_school_id()
  )
  WITH CHECK (
    is_super_admin() OR is_school_admin(school_id) OR school_id = get_auth_school_id()
  );

CREATE POLICY "students_delete_unified" ON public.students
  FOR DELETE TO authenticated
  USING (
    is_super_admin() OR is_school_admin(school_id) OR school_id = get_auth_school_id()
  );

-- ── ب-2) electronic_exams: write_unified (FOR ALL) تتداخل مع select_unified ──
DROP POLICY IF EXISTS "electronic_exams_write_unified"  ON public.electronic_exams;
DROP POLICY IF EXISTS "electronic_exams_insert_unified" ON public.electronic_exams;
DROP POLICY IF EXISTS "electronic_exams_update_unified" ON public.electronic_exams;
DROP POLICY IF EXISTS "electronic_exams_delete_unified" ON public.electronic_exams;

CREATE POLICY "electronic_exams_insert_unified" ON public.electronic_exams
  FOR INSERT TO authenticated
  WITH CHECK (
    get_auth_is_super_admin()
    OR (school_id = get_auth_school_id() AND get_auth_role() IN ('admin', 'teacher'))
  );

CREATE POLICY "electronic_exams_update_unified" ON public.electronic_exams
  FOR UPDATE TO authenticated
  USING (
    get_auth_is_super_admin()
    OR (school_id = get_auth_school_id() AND get_auth_role() IN ('admin', 'teacher'))
  )
  WITH CHECK (
    get_auth_is_super_admin()
    OR (school_id = get_auth_school_id() AND get_auth_role() IN ('admin', 'teacher'))
  );

CREATE POLICY "electronic_exams_delete_unified" ON public.electronic_exams
  FOR DELETE TO authenticated
  USING (
    get_auth_is_super_admin()
    OR (school_id = get_auth_school_id() AND get_auth_role() IN ('admin', 'teacher'))
  );

-- ── ب-3) exam_questions: write_unified (FOR ALL) تتداخل مع select_unified ────
DROP POLICY IF EXISTS "exam_questions_write_unified"  ON public.exam_questions;
DROP POLICY IF EXISTS "exam_questions_insert_unified" ON public.exam_questions;
DROP POLICY IF EXISTS "exam_questions_update_unified" ON public.exam_questions;
DROP POLICY IF EXISTS "exam_questions_delete_unified" ON public.exam_questions;

CREATE POLICY "exam_questions_insert_unified" ON public.exam_questions
  FOR INSERT TO authenticated
  WITH CHECK (
    get_auth_is_super_admin()
    OR (school_id = get_auth_school_id() AND get_auth_role() IN ('admin', 'teacher'))
  );

CREATE POLICY "exam_questions_update_unified" ON public.exam_questions
  FOR UPDATE TO authenticated
  USING (
    get_auth_is_super_admin()
    OR (school_id = get_auth_school_id() AND get_auth_role() IN ('admin', 'teacher'))
  )
  WITH CHECK (
    get_auth_is_super_admin()
    OR (school_id = get_auth_school_id() AND get_auth_role() IN ('admin', 'teacher'))
  );

CREATE POLICY "exam_questions_delete_unified" ON public.exam_questions
  FOR DELETE TO authenticated
  USING (
    get_auth_is_super_admin()
    OR (school_id = get_auth_school_id() AND get_auth_role() IN ('admin', 'teacher'))
  );

-- ── ب-4) exam_retake_grants: parent_select + staff_all (FOR ALL) متداخلان.
--        ندمجهما في سياسة SELECT واحدة + تفكيك الكتابة. ─────────────────────
DROP POLICY IF EXISTS "exam_retake_grants_staff_all"     ON public.exam_retake_grants;
DROP POLICY IF EXISTS "exam_retake_grants_parent_select" ON public.exam_retake_grants;
DROP POLICY IF EXISTS "exam_retake_grants_select_unified" ON public.exam_retake_grants;
DROP POLICY IF EXISTS "exam_retake_grants_insert_unified" ON public.exam_retake_grants;
DROP POLICY IF EXISTS "exam_retake_grants_update_unified" ON public.exam_retake_grants;
DROP POLICY IF EXISTS "exam_retake_grants_delete_unified" ON public.exam_retake_grants;

CREATE POLICY "exam_retake_grants_select_unified" ON public.exam_retake_grants
  FOR SELECT TO authenticated
  USING (
    get_auth_is_super_admin()
    OR (school_id = get_auth_school_id() AND get_auth_role() IN ('admin', 'teacher'))
    OR EXISTS (
      SELECT 1 FROM public.student_parents sp
      WHERE sp.student_id = exam_retake_grants.student_id
        AND sp.parent_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "exam_retake_grants_insert_unified" ON public.exam_retake_grants
  FOR INSERT TO authenticated
  WITH CHECK (
    get_auth_is_super_admin()
    OR (school_id = get_auth_school_id() AND get_auth_role() IN ('admin', 'teacher'))
  );

CREATE POLICY "exam_retake_grants_update_unified" ON public.exam_retake_grants
  FOR UPDATE TO authenticated
  USING (
    get_auth_is_super_admin()
    OR (school_id = get_auth_school_id() AND get_auth_role() IN ('admin', 'teacher'))
  )
  WITH CHECK (
    get_auth_is_super_admin()
    OR (school_id = get_auth_school_id() AND get_auth_role() IN ('admin', 'teacher'))
  );

CREATE POLICY "exam_retake_grants_delete_unified" ON public.exam_retake_grants
  FOR DELETE TO authenticated
  USING (
    get_auth_is_super_admin()
    OR (school_id = get_auth_school_id() AND get_auth_role() IN ('admin', 'teacher'))
  );

-- ── ب-5) push_subscriptions: user_access (FOR ALL) مجموعتها فرعية من
--        السياسات الأربع _unified → حذفها فقط. ────────────────────────────────
DROP POLICY IF EXISTS "push_subscriptions_user_access" ON public.push_subscriptions;

-- ═════════════════════════════════════════════════════════════════════════════
-- (ج) حذف الفهارس المكرّرة (نُبقي واحداً من كل زوج)
--     كل حذف داخل EXCEPTION حتى لا يتوقف الملف لو كان الفهرس مرتبطاً بقيد.
-- ═════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  idx TEXT;
  dup_indexes TEXT[] := ARRAY[
    'public.idx_class_chat_messages_room_order',
    'public.idx_curriculum_subjects_curriculum_id',
    'public.idx_exam_attempts_parent_id',
    'public.idx_exam_questions_order'
  ];
BEGIN
  FOREACH idx IN ARRAY dup_indexes LOOP
    BEGIN
      EXECUTE format('DROP INDEX IF EXISTS %s', idx);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'duplicate_index skip %: %', idx, SQLERRM;
    END;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
