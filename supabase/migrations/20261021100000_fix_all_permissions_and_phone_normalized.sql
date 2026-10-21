-- ==============================================================================
-- Migration: 20261021100000_fix_all_permissions_and_phone_normalized.sql
-- Purpose  : حل نهائي شامل لجميع أخطاء الصلاحيات والـ RLS:
--            1. حل خطأ 42501 (is_school_admin & is_super_admin) بمنح EXECUTE لـ anon و authenticated
--            2. ضمان تعريف دوال الأمان (is_school_admin) بكافة التوقيعات مع فحص auth.uid()
--            3. منح صلاحيات الجداول ديناميكياً بأمان تام
--            4. إصلاح phone_normalized في get_exam_review_questions
--            5. إعادة تحميل كاش PostgREST
-- ==============================================================================

SET search_path TO public;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. إعادة تعريف is_school_admin بأمان لكافة الحالات وتوقيعات المعاملات
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_school_admin(target_school_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND (
        is_super_admin = TRUE
        OR (
          role = 'admin' 
          AND approval_status = 'approved' 
          AND (school_id = target_school_id OR target_school_id IS NULL)
        )
      )
  );
END;
$$;

-- توقيع بدون معاملات في حال استدعائها بدون target_school_id
CREATE OR REPLACE FUNCTION public.is_school_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND (
        is_super_admin = TRUE
        OR (role = 'admin' AND approval_status = 'approved')
      )
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. إصلاح get_exam_review_questions: حذف phone_normalized واستبداله بـ regex
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_exam_review_questions(p_exam_id UUID)
RETURNS TABLE (
  id             UUID,
  exam_id        UUID,
  school_id      UUID,
  question_type  TEXT,
  question_text  TEXT,
  options        JSONB,
  correct_answer TEXT,
  order_index    INTEGER,
  created_at     TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID := auth.uid();
  v_role         TEXT;
  v_is_super     BOOLEAN;
  v_has_attempt  BOOLEAN := FALSE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    v_role     := public.get_auth_role();
    v_is_super := public.get_auth_is_super_admin();
  EXCEPTION WHEN OTHERS THEN
    v_role     := COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'role',
      auth.jwt() -> 'user_metadata' ->> 'role',
      'parent'
    );
    v_is_super := COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::BOOLEAN,
      FALSE
    );
  END;

  IF COALESCE(v_is_super, FALSE) OR v_role IN ('admin', 'teacher') THEN
    RETURN QUERY
    SELECT 
      q.id, q.exam_id, q.school_id, q.question_type, 
      q.question_text, q.options, q.correct_answer, q.order_index, q.created_at
    FROM public.exam_questions q
    WHERE q.exam_id = p_exam_id
    ORDER BY q.order_index ASC;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 
    FROM public.exam_attempts ea
    WHERE ea.exam_id = p_exam_id
      AND (
        ea.parent_id = v_user_id
        OR ea.student_id = v_user_id
        OR EXISTS (
          SELECT 1 FROM public.student_parents sp 
          WHERE sp.parent_id = v_user_id AND sp.student_id = ea.student_id
        )
        OR EXISTS (
          SELECT 1 
          FROM public.students s
          JOIN public.profiles p ON p.id = v_user_id
          WHERE s.id = ea.student_id
            AND right(regexp_replace(COALESCE(s.parent_phone,''), '[^0-9]', '', 'g'), 9) = 
                right(regexp_replace(COALESCE(p.phone,''), '[^0-9]', '', 'g'), 9)
            AND length(regexp_replace(COALESCE(p.phone,''), '[^0-9]', '', 'g')) >= 7
        )
      )
  ) INTO v_has_attempt;

  IF NOT v_has_attempt THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    q.id, q.exam_id, q.school_id, q.question_type, 
    q.question_text, q.options, q.correct_answer, q.order_index, q.created_at
  FROM public.exam_questions q
  WHERE q.exam_id = p_exam_id
  ORDER BY q.order_index ASC;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. منح صلاحيات الجداول الأساسية بشكل ديناميكي آمن
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  t TEXT;
  tbls TEXT[] := ARRAY[
    'teacher_attendance', 'attendance', 'conversations', 'conversation_messages',
    'class_chat_rooms', 'class_chat_messages', 'notifications', 'push_subscriptions',
    'schools', 'profiles', 'user_roles', 'students', 'classes', 'student_parents',
    'grades', 'fees', 'fee_payments', 'complaints', 'electronic_exams', 
    'exam_questions', 'exam_attempts'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      BEGIN
        IF t = 'schools' THEN
          EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon, authenticated, service_role', t);
        ELSIF t = 'profiles' THEN
          EXECUTE format('GRANT SELECT, UPDATE ON TABLE public.%I TO authenticated', t);
          EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role', t);
        ELSIF t = 'user_roles' THEN
          EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon, authenticated', t);
          EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role', t);
        ELSE
          EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated, service_role', t);
        END IF;
      EXCEPTION WHEN OTHERS THEN
      END;
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. حل أخطاء 42501 بالكامل: منح EXECUTE لكافة دوال الأمان والـ RLS لـ anon و authenticated
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT proname, oid::regprocedure AS func_sig
    FROM pg_proc
    WHERE proname IN (
      -- دوال الأمان والـ RLS (تتطلب منحها لـ anon و authenticated لأن السياسات تستدعيها)
      'is_school_admin',
      'is_super_admin',
      'get_my_school_id',
      'get_my_role',
      'get_my_approval_status',
      'has_role',
      'get_user_role',
      'get_auth_role',
      'get_auth_school_id',
      'get_auth_is_super_admin',
      'get_teacher_class_ids',
      'get_parent_student_ids',
      'normalize_phone',
      'phones_match',
      'get_school_id_by_slug',
      
      -- دوال الواجهات والـ RPC
      'get_complete_user_data',
      'get_parent_dashboard_summary',
      'get_child_full_details',
      'get_parent_electronic_exams',
      'submit_exam_attempt',
      'get_dashboard_stats',
      'get_admin_dashboard_activities',
      'get_fees_summary',
      'get_teacher_dashboard_stats',
      'recalculate_exam_scores',
      'check_exam_answer_matches',
      'get_exam_review_questions',
      'get_database_row_counts',
      'get_unread_notification_counts'
    )
    AND pronamespace = 'public'::regnamespace
  ) LOOP
    BEGIN
      -- منح authenticated و service_role لجميع الدوال
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.func_sig);

      -- منح anon أيضاً للدوال المستخدمة في سياسات الـ RLS المشتركة أو المفتوحة
      IF r.proname IN (
        'is_school_admin',
        'is_super_admin',
        'get_auth_role',
        'get_auth_school_id',
        'get_auth_is_super_admin',
        'get_school_id_by_slug',
        'has_role',
        'get_user_role',
        'get_my_school_id',
        'get_my_role'
      ) THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', r.func_sig);
      END IF;
    EXCEPTION WHEN OTHERS THEN
    END;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ضبط سياسات push_subscriptions
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'push_subscriptions') THEN
    EXECUTE 'ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "push_subscriptions_user_access" ON public.push_subscriptions';
    EXECUTE 'CREATE POLICY "push_subscriptions_user_access" ON public.push_subscriptions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
    EXECUTE 'DROP POLICY IF EXISTS "push_subscriptions_service_role" ON public.push_subscriptions';
    EXECUTE 'CREATE POLICY "push_subscriptions_service_role" ON public.push_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. تحديث كاش schema في PostgREST
-- ─────────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
