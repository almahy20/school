-- ==========================================================================
-- Migration: 20260903400000_fix_rls_performance_linter.sql
-- Purpose  : إصلاح تحذيرات Security Linter (PERFORMANCE)
--
-- المشاكل المُصلَحة:
--   1. auth_rls_initplan (57 تحذير)
--      → استبدال auth.uid() بـ (select auth.uid()) في جميع الـ policies
--      → يمنع PostgreSQL من إعادة تقييمها لكل صف
--
--   2. multiple_permissive_policies
--      → دمج policies متعددة لنفس العملية/الدور في policy واحدة
--      → الجداول المتأثرة: profiles, conversations, conversation_messages,
--        teacher_attendance, notifications
--
--   3. duplicate_index (5 تحذيرات)
--      → حذف الفهارس المكررة
--
-- الاستراتيجية:
--   - لكل جدول: DROP الـ policies القديمة ثم CREATE الجديدة بـ (select auth.uid())
--   - للـ multiple_permissive_policies: دمج SELECT+SELECT أو INSERT+INSERT في policy واحدة
--   - لا نمس الجداول التي لم تأت بتحذيرات (نبقيها كما هي)
-- ==========================================================================

SET search_path TO public;

-- ==========================================================================
-- الجزء 1: DUPLICATE INDEXES — إصلاح سريع
-- ==========================================================================

-- complaints: يبقى idx_complaints_school_created (المُضاف في 20260903100000)
DROP INDEX IF EXISTS public.idx_complaints_created_at;
DROP INDEX IF EXISTS public.idx_complaints_date;

-- fee_payments: يبقى idx_fee_payments_school_fee و idx_fee_payments_school_date
DROP INDEX IF EXISTS public.idx_fee_payments_fee_id;
DROP INDEX IF EXISTS public.idx_fee_payments_school_id;

-- push_delivery_log
DROP INDEX IF EXISTS public.idx_push_delivery_log_notification_id;
DROP INDEX IF EXISTS public.idx_push_delivery_log_queued_at;

-- push_subscriptions: يبقى push_subscriptions_endpoint_key (UNIQUE constraint)
DROP INDEX IF EXISTS public.push_subscriptions_endpoint_idx;

-- ==========================================================================
-- الجزء 2: TEACHER_ATTENDANCE
-- auth_rls_initplan + multiple_permissive_policies (SELECT: Admins + Teachers)
-- الحل: دمج في policy SELECT واحدة + إبقاء الـ ALL policy للمدراء بشكل منفصل
-- ==========================================================================

DROP POLICY IF EXISTS "Admins full access"  ON public.teacher_attendance;
DROP POLICY IF EXISTS "Teachers view own"   ON public.teacher_attendance;

-- Policy 1: المدراء — وصول كامل (ALL operations) مع (select auth.uid())
CREATE POLICY "teacher_attendance_admin_all"
    ON public.teacher_attendance
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id      = (select auth.uid())
              AND user_roles.role         = 'admin'
              AND user_roles.approval_status = 'approved'
              AND user_roles.school_id    = teacher_attendance.school_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id      = (select auth.uid())
              AND user_roles.role         = 'admin'
              AND user_roles.approval_status = 'approved'
              AND user_roles.school_id    = teacher_attendance.school_id
        )
    );

-- Policy 2: المعلمون — قراءة سجلاتهم فقط
-- ملاحظة: إبقاؤها منفصلة عن المدراء مقصود (منطق مختلف)
-- لكن نستخدم (select auth.uid()) لإصلاح initplan
CREATE POLICY "teacher_attendance_teacher_select"
    ON public.teacher_attendance
    FOR SELECT
    USING (teacher_id = (select auth.uid()));

-- ==========================================================================
-- الجزء 3: NOTIFICATIONS
-- auth_rls_initplan: notifications_view_own, notifications_admin_view
-- multiple_permissive_policies: دمج SELECT واحدة
-- ==========================================================================

DROP POLICY IF EXISTS "notifications_view_own"    ON public.notifications;
DROP POLICY IF EXISTS "notifications_admin_view"  ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own"  ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete_own"  ON public.notifications;

-- Policy موحدة للـ SELECT: المستخدم يرى إشعاراته أو إشعارات مدرسته (إذا أدمن)
CREATE POLICY "notifications_select"
    ON public.notifications
    FOR SELECT TO authenticated
    USING (
        user_id = (select auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.user_roles admin_check
            WHERE admin_check.user_id       = (select auth.uid())
              AND admin_check.role          = 'admin'
              AND admin_check.approval_status = 'approved'
              AND admin_check.school_id     = notifications.school_id
        )
    );

-- Policy للـ UPDATE (تحديث is_read)
CREATE POLICY "notifications_update"
    ON public.notifications
    FOR UPDATE TO authenticated
    USING    (user_id = (select auth.uid()))
    WITH CHECK (user_id = (select auth.uid()));

-- Policy للـ DELETE
CREATE POLICY "notifications_delete"
    ON public.notifications
    FOR DELETE TO authenticated
    USING (user_id = (select auth.uid()));

-- ==========================================================================
-- الجزء 4: PROFILES
-- auth_rls_initplan: profiles_view_own, profiles_view_policy, profiles_update_own
-- multiple_permissive_policies: دمج profiles_view_own + profiles_view_policy
-- ==========================================================================

DROP POLICY IF EXISTS "profiles_view_own"    ON public.profiles;
DROP POLICY IF EXISTS "profiles_view_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_new"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_self"        ON public.profiles;

-- Policy SELECT موحدة (تدمج profiles_view_own + profiles_view_policy)
-- تغطي: المستخدم نفسه + نفس المدرسة + super admin + teacher رؤية أولياء الأمر
CREATE POLICY "profiles_select"
    ON public.profiles
    FOR SELECT TO authenticated
    USING (
        -- المستخدم يرى ملفه الشخصي
        id = (select auth.uid())

        OR

        -- أي مستخدم في نفس المدرسة
        school_id = (
            SELECT ur.school_id FROM public.user_roles ur
            WHERE ur.user_id = (select auth.uid())
            LIMIT 1
        )

        OR

        -- Super Admin يرى الجميع
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id      = (select auth.uid())
              AND is_super_admin = true
            LIMIT 1
        )

        OR

        -- المعلم يرى ملفات أولياء أمر طلابه
        EXISTS (
            SELECT 1 FROM public.student_parents sp
            INNER JOIN public.students s  ON s.id  = sp.student_id
            INNER JOIN public.classes   c ON c.id  = s.class_id
            WHERE c.teacher_id = (select auth.uid())
              AND sp.parent_id = profiles.id
        )
    );

-- Policy UPDATE: المستخدم يعدّل ملفه فقط
CREATE POLICY "profiles_update"
    ON public.profiles
    FOR UPDATE TO authenticated
    USING    (id = (select auth.uid()))
    WITH CHECK (id = (select auth.uid()));

-- ==========================================================================
-- الجزء 5: USER_ROLES
-- auth_rls_initplan: user_roles_view_own
-- ==========================================================================

DROP POLICY IF EXISTS "user_roles_view_own" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_self"     ON public.user_roles;

CREATE POLICY "user_roles_select_own"
    ON public.user_roles
    FOR SELECT TO authenticated
    USING (user_id = (select auth.uid()));

-- ==========================================================================
-- الجزء 6: CONVERSATIONS
-- auth_rls_initplan: كل الـ policies
-- multiple_permissive_policies:
--   SELECT: conv_parent_select + conv_admin_select + conv_super_admin → دمج
--   INSERT: conv_parent_insert + conv_super_admin → دمج
--   UPDATE: conv_parent_update + conv_admin_update + conv_super_admin → دمج
--   DELETE: conv_admin_delete + conv_super_admin → دمج
-- ==========================================================================

DROP POLICY IF EXISTS "conv_parent_select" ON public.conversations;
DROP POLICY IF EXISTS "conv_parent_insert" ON public.conversations;
DROP POLICY IF EXISTS "conv_parent_update" ON public.conversations;
DROP POLICY IF EXISTS "conv_admin_select"  ON public.conversations;
DROP POLICY IF EXISTS "conv_admin_update"  ON public.conversations;
DROP POLICY IF EXISTS "conv_admin_delete"  ON public.conversations;
DROP POLICY IF EXISTS "conv_super_admin"   ON public.conversations;

-- SELECT موحد: وليّ الأمر أو أدمن المدرسة أو super admin
CREATE POLICY "conversations_select"
    ON public.conversations
    FOR SELECT
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
    );

-- INSERT موحد: وليّ الأمر ينشئ محادثاته فقط، أو super admin
CREATE POLICY "conversations_insert"
    ON public.conversations
    FOR INSERT
    WITH CHECK (
        parent_id = (select auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = (select auth.uid()) AND is_super_admin = true
        )
    );

-- UPDATE موحد: وليّ الأمر أو أدمن المدرسة أو super admin
CREATE POLICY "conversations_update"
    ON public.conversations
    FOR UPDATE
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
    );

-- DELETE: أدمن أو super admin
CREATE POLICY "conversations_delete"
    ON public.conversations
    FOR DELETE
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
    );

-- ==========================================================================
-- الجزء 7: CONVERSATION_MESSAGES
-- auth_rls_initplan: كل الـ policies
-- multiple_permissive_policies:
--   SELECT: cmsg_parent_select + cmsg_admin_select + cmsg_super_admin → دمج
--   INSERT: cmsg_parent_insert + cmsg_admin_insert + cmsg_super_admin → دمج
--   UPDATE: cmsg_admin_update + cmsg_super_admin → دمج
-- ==========================================================================

DROP POLICY IF EXISTS "cmsg_parent_select" ON public.conversation_messages;
DROP POLICY IF EXISTS "cmsg_parent_insert" ON public.conversation_messages;
DROP POLICY IF EXISTS "cmsg_admin_select"  ON public.conversation_messages;
DROP POLICY IF EXISTS "cmsg_admin_insert"  ON public.conversation_messages;
DROP POLICY IF EXISTS "cmsg_admin_update"  ON public.conversation_messages;
DROP POLICY IF EXISTS "cmsg_super_admin"   ON public.conversation_messages;

-- SELECT موحد: وليّ الأمر (رسائله غير المحذوفة) أو أدمن المدرسة أو super admin
CREATE POLICY "conv_messages_select"
    ON public.conversation_messages
    FOR SELECT
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
    );

-- INSERT موحد: وليّ الأمر أو أدمن/معلم أو super admin
CREATE POLICY "conv_messages_insert"
    ON public.conversation_messages
    FOR INSERT
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
    );

-- UPDATE: أدمن أو super admin
CREATE POLICY "conv_messages_update"
    ON public.conversation_messages
    FOR UPDATE
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
    );

-- ==========================================================================
-- الجزء 8: PUSH_SUBSCRIPTIONS
-- auth_rls_initplan على 4 policies
-- ==========================================================================

DROP POLICY IF EXISTS "Users can insert their own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can read their own push subscriptions"   ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update their own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete their own push subscriptions" ON public.push_subscriptions;

CREATE POLICY "push_subscriptions_own"
    ON public.push_subscriptions
    FOR ALL TO authenticated
    USING    (user_id = (select auth.uid()))
    WITH CHECK (user_id = (select auth.uid()));

-- ==========================================================================
-- الجزء 9: إصلاح auth_rls_initplan للجداول الأخرى
-- الجداول التي لا تحتاج دمج policies، فقط استبدال auth.uid()
-- ==========================================================================

-- ── audit_logs ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can see their school logs"  ON public.audit_logs;
DROP POLICY IF EXISTS "Super admins can see all logs"     ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated users can insert logs" ON public.audit_logs;

CREATE POLICY "audit_logs_admin_select"
    ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id      = (select auth.uid())
              AND ur.role          = 'admin'
              AND ur.school_id     = audit_logs.school_id
              AND ur.approval_status = 'approved'
        )
    );

CREATE POLICY "audit_logs_super_admin_select"
    ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = (select auth.uid()) AND is_super_admin = true
        )
    );

CREATE POLICY "audit_logs_insert"
    ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (select auth.uid()) OR user_id IS NULL);

-- ── student_parents ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "student_parents_admin_insert"          ON public.student_parents;
DROP POLICY IF EXISTS "student_parents_parent_view"           ON public.student_parents;
DROP POLICY IF EXISTS "student_parents_admin_manage"          ON public.student_parents;
DROP POLICY IF EXISTS "student_parents_admin_policy"          ON public.student_parents;
DROP POLICY IF EXISTS "student_parents_parent_view_policy"    ON public.student_parents;

-- Admin: وصول كامل
CREATE POLICY "student_parents_admin_all"
    ON public.student_parents
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id      = (select auth.uid())
              AND ur.role          = 'admin'
              AND ur.school_id     = student_parents.school_id
              AND ur.approval_status = 'approved'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id      = (select auth.uid())
              AND ur.role          = 'admin'
              AND ur.school_id     = student_parents.school_id
              AND ur.approval_status = 'approved'
        )
    );

-- Parent: يرى أبناءه فقط
CREATE POLICY "student_parents_parent_select"
    ON public.student_parents
    FOR SELECT TO authenticated
    USING (parent_id = (select auth.uid()));

-- ==========================================================================
-- الجزء 10: ANALYZE للجداول المتأثرة
-- ==========================================================================

ANALYZE public.teacher_attendance;
ANALYZE public.notifications;
ANALYZE public.profiles;
ANALYZE public.user_roles;
ANALYZE public.conversations;
ANALYZE public.conversation_messages;
ANALYZE public.push_subscriptions;
ANALYZE public.audit_logs;
ANALYZE public.student_parents;

NOTIFY pgrst, 'reload schema';
