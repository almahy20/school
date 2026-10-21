-- ==============================================================================
-- Migration: 20261021100000_fix_all_permissions_and_phone_normalized.sql
-- Purpose  : إصلاح شامل لكل الأخطاء المكتشفة:
--            1. إصلاح phone_normalized (عمود غير موجود) في get_exam_review_questions
--            2. منح صلاحيات مفقودة لـ push_subscriptions, user_roles, profiles, schools
--            3. منح صلاحيات تنفيذ لـ RPCs الأساسية (get_parent_dashboard_summary, get_complete_user_data)
--            4. منح صلاحيات get_auth_role, get_auth_school_id, get_auth_is_super_admin
-- ==============================================================================

SET search_path TO public;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. إصلاح get_exam_review_questions: حذف phone_normalized واستبداله بـ regex
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

  -- استخدام get_auth_role() إن وُجدت، وإلا fallback للـ JWT
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

  -- أ) المعلمون والإدارة والسوبر أدمن يمكنهم المراجعة دائماً
  IF v_is_super OR v_role IN ('admin', 'teacher') THEN
    RETURN QUERY
    SELECT 
      q.id, q.exam_id, q.school_id, q.question_type, 
      q.question_text, q.options, q.correct_answer, q.order_index, q.created_at
    FROM public.exam_questions q
    WHERE q.exam_id = p_exam_id
    ORDER BY q.order_index ASC;
    RETURN;
  END IF;

  -- ب) ولي الأمر / الطالب: فحص وجود محاولة مرتبطة بالمستخدم
  --    (عبر parent_id المباشر، أو student_parents، أو تطابق رقم الهاتف)
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
          -- تطابق رقم الهاتف: آخر 9 أرقام فقط (إصلاح BUG-01: لا phone_normalized)
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

  -- إذا لم تُوجد محاولة، نرجع فارغاً بهدوء
  IF NOT v_has_attempt THEN
    RETURN;
  END IF;

  -- ج) إرجاع الأسئلة مع correct_answer
  RETURN QUERY
  SELECT 
    q.id, q.exam_id, q.school_id, q.question_type, 
    q.question_text, q.options, q.correct_answer, q.order_index, q.created_at
  FROM public.exam_questions q
  WHERE q.exam_id = p_exam_id
  ORDER BY q.order_index ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_exam_review_questions(UUID) 
  TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. منح صلاحيات جداول الأمان الأساسية (BUG-03, BUG-06)
-- ─────────────────────────────────────────────────────────────────────────────

-- push_subscriptions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions 
  TO authenticated, service_role;

-- user_roles (قراءة فقط للـ authenticated — الكتابة للـ service_role فقط لأسباب أمنية)
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO service_role;

-- profiles
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated, service_role;

-- schools (قراءة فقط)
GRANT SELECT ON public.schools TO authenticated;

-- notifications
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications 
  TO authenticated, service_role;

-- conversations & chat
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations 
  TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_messages 
  TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_chat_rooms 
  TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_chat_messages 
  TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. منح صلاحيات الـ RPC الأساسية للمصادقة (طريقة ديناميكية بالـ regprocedure تمنع أي mismatch في المعاملات)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT proname, oid::regprocedure AS func_sig
    FROM pg_proc
    WHERE proname IN (
      'get_complete_user_data',
      'get_parent_dashboard_summary',
      'get_child_full_details',
      'get_parent_electronic_exams',
      'submit_exam_attempt',
      'get_auth_role',
      'get_auth_school_id',
      'get_auth_is_super_admin',
      'get_dashboard_stats',
      'get_admin_dashboard_activities',
      'get_fees_summary',
      'get_teacher_dashboard_stats',
      'recalculate_exam_scores',
      'check_exam_answer_matches',
      'get_exam_review_questions'
    )
    AND pronamespace = 'public'::regnamespace
  ) LOOP
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.func_sig);
      IF r.proname IN ('get_auth_role', 'get_auth_school_id', 'get_auth_is_super_admin') THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', r.func_sig);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- تجاهل أي دالة بها خطأ فردي والانتقال للتالية بأمان تام
    END;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. تأكد من وجود RLS policies صحيحة لـ push_subscriptions
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions_user_access" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_user_access" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- service_role يمكنه قراءة الكل (لإرسال الإشعارات من Edge Functions)
DROP POLICY IF EXISTS "push_subscriptions_service_role" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_service_role" ON public.push_subscriptions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Reload PostgREST schema cache
-- ─────────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
