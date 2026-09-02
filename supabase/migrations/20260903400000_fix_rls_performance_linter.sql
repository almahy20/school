-- ==========================================================================
-- Migration: 20260903400000_fix_rls_performance_linter.sql
-- Purpose  : إصلاح تحذيرات Security Linter (PERFORMANCE) — idempotent
--
-- كل section محاطة بـ DO block يتحقق من وجود الجدول أولاً قبل أي تعديل،
-- لأن هذه الـ migration قد تُشغَّل على بيئات مختلفة.
-- ==========================================================================

SET search_path TO public;

-- ==========================================================================
-- الجزء 1: DUPLICATE INDEXES
-- ==========================================================================

DROP INDEX IF EXISTS public.idx_complaints_created_at;
DROP INDEX IF EXISTS public.idx_complaints_date;
DROP INDEX IF EXISTS public.idx_fee_payments_fee_id;
DROP INDEX IF EXISTS public.idx_fee_payments_school_id;
DROP INDEX IF EXISTS public.idx_push_delivery_log_notification_id;
DROP INDEX IF EXISTS public.idx_push_delivery_log_queued_at;
DROP INDEX IF EXISTS public.push_subscriptions_endpoint_idx;

-- ==========================================================================
-- الجزء 2: TEACHER_ATTENDANCE
-- ==========================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'teacher_attendance'
  ) THEN
    DROP POLICY IF EXISTS "Admins full access"               ON public.teacher_attendance;
    DROP POLICY IF EXISTS "teacher_attendance_admin_all"     ON public.teacher_attendance;
    DROP POLICY IF EXISTS "Teachers view own"                ON public.teacher_attendance;
    DROP POLICY IF EXISTS "teacher_attendance_teacher_select" ON public.teacher_attendance;

    EXECUTE $p$
      CREATE POLICY "teacher_attendance_admin_all"
        ON public.teacher_attendance FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id        = (select auth.uid())
              AND user_roles.role            = 'admin'
              AND user_roles.approval_status = 'approved'
              AND user_roles.school_id       = teacher_attendance.school_id
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id        = (select auth.uid())
              AND user_roles.role            = 'admin'
              AND user_roles.approval_status = 'approved'
              AND user_roles.school_id       = teacher_attendance.school_id
          )
        )
    $p$;

    EXECUTE $p$
      CREATE POLICY "teacher_attendance_teacher_select"
        ON public.teacher_attendance FOR SELECT
        USING (teacher_id = (select auth.uid()))
    $p$;

    RAISE NOTICE 'teacher_attendance: policies updated.';
  ELSE
    RAISE NOTICE 'teacher_attendance: table not found — skipped.';
  END IF;
END;
$$;

-- ==========================================================================
-- الجزء 3: NOTIFICATIONS
-- ==========================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) THEN
    DROP POLICY IF EXISTS "notifications_view_own"    ON public.notifications;
    DROP POLICY IF EXISTS "notifications_admin_view"  ON public.notifications;
    DROP POLICY IF EXISTS "notifications_update_own"  ON public.notifications;
    DROP POLICY IF EXISTS "notifications_delete_own"  ON public.notifications;
    DROP POLICY IF EXISTS "notifications_select"      ON public.notifications;
    DROP POLICY IF EXISTS "notifications_update"      ON public.notifications;
    DROP POLICY IF EXISTS "notifications_delete"      ON public.notifications;

    EXECUTE $p$
      CREATE POLICY "notifications_select"
        ON public.notifications FOR SELECT TO authenticated
        USING (
          user_id = (select auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.user_roles ac
            WHERE ac.user_id        = (select auth.uid())
              AND ac.role            = 'admin'
              AND ac.approval_status = 'approved'
              AND ac.school_id       = notifications.school_id
          )
        )
    $p$;

    EXECUTE $p$
      CREATE POLICY "notifications_update"
        ON public.notifications FOR UPDATE TO authenticated
        USING     (user_id = (select auth.uid()))
        WITH CHECK (user_id = (select auth.uid()))
    $p$;

    EXECUTE $p$
      CREATE POLICY "notifications_delete"
        ON public.notifications FOR DELETE TO authenticated
        USING (user_id = (select auth.uid()))
    $p$;

    RAISE NOTICE 'notifications: policies updated.';
  ELSE
    RAISE NOTICE 'notifications: table not found — skipped.';
  END IF;
END;
$$;

-- ==========================================================================
-- الجزء 4: PROFILES
-- ==========================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    DROP POLICY IF EXISTS "profiles_view_own"    ON public.profiles;
    DROP POLICY IF EXISTS "profiles_view_policy" ON public.profiles;
    DROP POLICY IF EXISTS "profiles_update_own"  ON public.profiles;
    DROP POLICY IF EXISTS "profiles_update_new"  ON public.profiles;
    DROP POLICY IF EXISTS "profiles_self"        ON public.profiles;
    DROP POLICY IF EXISTS "profiles_select"      ON public.profiles;
    DROP POLICY IF EXISTS "profiles_update"      ON public.profiles;

    EXECUTE $p$
      CREATE POLICY "profiles_select"
        ON public.profiles FOR SELECT TO authenticated
        USING (
          id = (select auth.uid())
          OR school_id = (
            SELECT ur.school_id FROM public.user_roles ur
            WHERE ur.user_id = (select auth.uid()) LIMIT 1
          )
          OR EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = (select auth.uid()) AND is_super_admin = true LIMIT 1
          )
          OR EXISTS (
            SELECT 1 FROM public.student_parents sp
            INNER JOIN public.students  s ON s.id  = sp.student_id
            INNER JOIN public.classes   c ON c.id  = s.class_id
            WHERE c.teacher_id = (select auth.uid())
              AND sp.parent_id = profiles.id
          )
        )
    $p$;

    EXECUTE $p$
      CREATE POLICY "profiles_update"
        ON public.profiles FOR UPDATE TO authenticated
        USING     (id = (select auth.uid()))
        WITH CHECK (id = (select auth.uid()))
    $p$;

    RAISE NOTICE 'profiles: policies updated.';
  ELSE
    RAISE NOTICE 'profiles: table not found — skipped.';
  END IF;
END;
$$;

-- ==========================================================================
-- الجزء 5: USER_ROLES
-- ==========================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_roles'
  ) THEN
    DROP POLICY IF EXISTS "user_roles_view_own"    ON public.user_roles;
    DROP POLICY IF EXISTS "user_roles_self"        ON public.user_roles;
    DROP POLICY IF EXISTS "user_roles_select_own"  ON public.user_roles;

    EXECUTE $p$
      CREATE POLICY "user_roles_select_own"
        ON public.user_roles FOR SELECT TO authenticated
        USING (user_id = (select auth.uid()))
    $p$;

    RAISE NOTICE 'user_roles: policy updated.';
  ELSE
    RAISE NOTICE 'user_roles: table not found — skipped.';
  END IF;
END;
$$;

-- ==========================================================================
-- الجزء 6: CONVERSATIONS
-- ==========================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'conversations'
  ) THEN
    DROP POLICY IF EXISTS "conv_parent_select"   ON public.conversations;
    DROP POLICY IF EXISTS "conv_parent_insert"   ON public.conversations;
    DROP POLICY IF EXISTS "conv_parent_update"   ON public.conversations;
    DROP POLICY IF EXISTS "conv_admin_select"    ON public.conversations;
    DROP POLICY IF EXISTS "conv_admin_update"    ON public.conversations;
    DROP POLICY IF EXISTS "conv_admin_delete"    ON public.conversations;
    DROP POLICY IF EXISTS "conv_super_admin"     ON public.conversations;
    DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
    DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
    DROP POLICY IF EXISTS "conversations_update" ON public.conversations;
    DROP POLICY IF EXISTS "conversations_delete" ON public.conversations;

    EXECUTE $p$
      CREATE POLICY "conversations_select"
        ON public.conversations FOR SELECT
        USING (
          parent_id = (select auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id  = (select auth.uid())
              AND ur.role      = 'admin'
              AND ur.school_id = conversations.school_id
          )
          OR EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = (select auth.uid()) AND is_super_admin = true
          )
        )
    $p$;

    EXECUTE $p$
      CREATE POLICY "conversations_insert"
        ON public.conversations FOR INSERT
        WITH CHECK (
          parent_id = (select auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = (select auth.uid()) AND is_super_admin = true
          )
        )
    $p$;

    EXECUTE $p$
      CREATE POLICY "conversations_update"
        ON public.conversations FOR UPDATE
        USING (
          parent_id = (select auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id  = (select auth.uid())
              AND ur.role      = 'admin'
              AND ur.school_id = conversations.school_id
          )
          OR EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = (select auth.uid()) AND is_super_admin = true
          )
        )
    $p$;

    EXECUTE $p$
      CREATE POLICY "conversations_delete"
        ON public.conversations FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id  = (select auth.uid())
              AND ur.role      = 'admin'
              AND ur.school_id = conversations.school_id
          )
          OR EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = (select auth.uid()) AND is_super_admin = true
          )
        )
    $p$;

    RAISE NOTICE 'conversations: policies updated.';
  ELSE
    RAISE NOTICE 'conversations: table not found — skipped.';
  END IF;
END;
$$;

-- ==========================================================================
-- الجزء 7: CONVERSATION_MESSAGES
-- ==========================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'conversation_messages'
  ) THEN
    DROP POLICY IF EXISTS "cmsg_parent_select"     ON public.conversation_messages;
    DROP POLICY IF EXISTS "cmsg_parent_insert"     ON public.conversation_messages;
    DROP POLICY IF EXISTS "cmsg_admin_select"      ON public.conversation_messages;
    DROP POLICY IF EXISTS "cmsg_admin_insert"      ON public.conversation_messages;
    DROP POLICY IF EXISTS "cmsg_admin_update"      ON public.conversation_messages;
    DROP POLICY IF EXISTS "cmsg_super_admin"       ON public.conversation_messages;
    DROP POLICY IF EXISTS "conv_messages_select"   ON public.conversation_messages;
    DROP POLICY IF EXISTS "conv_messages_insert"   ON public.conversation_messages;
    DROP POLICY IF EXISTS "conv_messages_update"   ON public.conversation_messages;

    EXECUTE $p$
      CREATE POLICY "conv_messages_select"
        ON public.conversation_messages FOR SELECT
        USING (
          (
            deleted_by_admin = false
            AND EXISTS (
              SELECT 1 FROM public.conversations c
              WHERE c.id        = conversation_id
                AND c.parent_id = (select auth.uid())
            )
          )
          OR EXISTS (
            SELECT 1 FROM public.conversations c
            JOIN public.user_roles ur ON ur.school_id = c.school_id
            WHERE c.id       = conversation_id
              AND ur.user_id = (select auth.uid())
              AND ur.role     = 'admin'
          )
          OR EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = (select auth.uid()) AND is_super_admin = true
          )
        )
    $p$;

    EXECUTE $p$
      CREATE POLICY "conv_messages_insert"
        ON public.conversation_messages FOR INSERT
        WITH CHECK (
          sender_id = (select auth.uid())
          AND (
            EXISTS (
              SELECT 1 FROM public.conversations c
              WHERE c.id        = conversation_id
                AND c.parent_id = (select auth.uid())
            )
            OR EXISTS (
              SELECT 1 FROM public.conversations c
              JOIN public.user_roles ur ON ur.school_id = c.school_id
              WHERE c.id       = conversation_id
                AND ur.user_id = (select auth.uid())
                AND ur.role     IN ('admin', 'teacher')
            )
            OR EXISTS (
              SELECT 1 FROM public.user_roles
              WHERE user_id = (select auth.uid()) AND is_super_admin = true
            )
          )
        )
    $p$;

    EXECUTE $p$
      CREATE POLICY "conv_messages_update"
        ON public.conversation_messages FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM public.conversations c
            JOIN public.user_roles ur ON ur.school_id = c.school_id
            WHERE c.id       = conversation_id
              AND ur.user_id = (select auth.uid())
              AND ur.role     = 'admin'
          )
          OR EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = (select auth.uid()) AND is_super_admin = true
          )
        )
    $p$;

    RAISE NOTICE 'conversation_messages: policies updated.';
  ELSE
    RAISE NOTICE 'conversation_messages: table not found — skipped.';
  END IF;
END;
$$;

-- ==========================================================================
-- الجزء 8: PUSH_SUBSCRIPTIONS
-- ==========================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'push_subscriptions'
  ) THEN
    DROP POLICY IF EXISTS "Users can insert their own push subscriptions" ON public.push_subscriptions;
    DROP POLICY IF EXISTS "Users can read their own push subscriptions"   ON public.push_subscriptions;
    DROP POLICY IF EXISTS "Users can update their own push subscriptions" ON public.push_subscriptions;
    DROP POLICY IF EXISTS "Users can delete their own push subscriptions" ON public.push_subscriptions;
    DROP POLICY IF EXISTS "push_subscriptions_own"                        ON public.push_subscriptions;

    EXECUTE $p$
      CREATE POLICY "push_subscriptions_own"
        ON public.push_subscriptions FOR ALL TO authenticated
        USING     (user_id = (select auth.uid()))
        WITH CHECK (user_id = (select auth.uid()))
    $p$;

    RAISE NOTICE 'push_subscriptions: policy updated.';
  ELSE
    RAISE NOTICE 'push_subscriptions: table not found — skipped.';
  END IF;
END;
$$;

-- ==========================================================================
-- الجزء 9: AUDIT_LOGS
-- ==========================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    DROP POLICY IF EXISTS "Admins can see their school logs"    ON public.audit_logs;
    DROP POLICY IF EXISTS "Super admins can see all logs"       ON public.audit_logs;
    DROP POLICY IF EXISTS "Authenticated users can insert logs" ON public.audit_logs;
    DROP POLICY IF EXISTS "audit_logs_admin_select"             ON public.audit_logs;
    DROP POLICY IF EXISTS "audit_logs_super_admin_select"       ON public.audit_logs;
    DROP POLICY IF EXISTS "audit_logs_insert"                   ON public.audit_logs;

    EXECUTE $p$
      CREATE POLICY "audit_logs_admin_select"
        ON public.audit_logs FOR SELECT TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id        = (select auth.uid())
              AND ur.role            = 'admin'
              AND ur.school_id       = audit_logs.school_id
              AND ur.approval_status = 'approved'
          )
        )
    $p$;

    EXECUTE $p$
      CREATE POLICY "audit_logs_super_admin_select"
        ON public.audit_logs FOR SELECT TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = (select auth.uid()) AND is_super_admin = true
          )
        )
    $p$;

    EXECUTE $p$
      CREATE POLICY "audit_logs_insert"
        ON public.audit_logs FOR INSERT TO authenticated
        WITH CHECK (
          user_id = (select auth.uid()) OR user_id IS NULL
        )
    $p$;

    RAISE NOTICE 'audit_logs: policies updated.';
  ELSE
    RAISE NOTICE 'audit_logs: table not found — skipped.';
  END IF;
END;
$$;

-- ==========================================================================
-- الجزء 10: STUDENT_PARENTS
-- ==========================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_parents'
  ) THEN
    DROP POLICY IF EXISTS "student_parents_admin_insert"        ON public.student_parents;
    DROP POLICY IF EXISTS "student_parents_parent_view"         ON public.student_parents;
    DROP POLICY IF EXISTS "student_parents_admin_manage"        ON public.student_parents;
    DROP POLICY IF EXISTS "student_parents_admin_policy"        ON public.student_parents;
    DROP POLICY IF EXISTS "student_parents_parent_view_policy"  ON public.student_parents;
    DROP POLICY IF EXISTS "student_parents_admin_all"           ON public.student_parents;
    DROP POLICY IF EXISTS "student_parents_parent_select"       ON public.student_parents;

    EXECUTE $p$
      CREATE POLICY "student_parents_admin_all"
        ON public.student_parents FOR ALL TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id        = (select auth.uid())
              AND ur.role            = 'admin'
              AND ur.school_id       = student_parents.school_id
              AND ur.approval_status = 'approved'
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id        = (select auth.uid())
              AND ur.role            = 'admin'
              AND ur.school_id       = student_parents.school_id
              AND ur.approval_status = 'approved'
          )
        )
    $p$;

    EXECUTE $p$
      CREATE POLICY "student_parents_parent_select"
        ON public.student_parents FOR SELECT TO authenticated
        USING (parent_id = (select auth.uid()))
    $p$;

    RAISE NOTICE 'student_parents: policies updated.';
  ELSE
    RAISE NOTICE 'student_parents: table not found — skipped.';
  END IF;
END;
$$;

-- ==========================================================================
-- ANALYZE للجداول الموجودة فقط
-- ==========================================================================

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'teacher_attendance','notifications','profiles','user_roles',
    'conversations','conversation_messages','push_subscriptions',
    'audit_logs','student_parents'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('ANALYZE public.%I', tbl);
    END IF;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
