-- ==========================================================================
-- Migration: 20260904000000_force_schema_cache_reload.sql
-- Purpose  : إصلاح خطأ "relation public.notifications does not exist"
--            الذي ظهر عند تشغيل 20260903100000_fix_slow_rpc_functions.sql
--
-- السبب الجذري:
--   الدالة get_unread_notification_counts تُنشأ قبل وجود جدول notifications
--   في قاعدة البيانات، فيفشل PostgreSQL عند compile time (42P01).
--
-- الترتيب الصحيح في هذا الملف:
--   0. NOTIFY مبكر لبدء إعادة تحميل cache
--   1. إنشاء جدول notifications أولاً (IF NOT EXISTS — idempotent)
--   2. ضمان وجود الأعمدة المفقودة في profiles و conversations
--   3. إعادة تسجيل get_dashboard_stats
--   4. إعادة تسجيل get_admin_dashboard_activities
--   5. إعادة تسجيل get_unread_notification_counts (الآن الجدول موجود)
--   6. إعادة تسجيل get_fees_summary
--   7. NOTIFY نهائي
--
-- Idempotency: الملف آمن للتطبيق أكثر من مرة
--   CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
--   CREATE OR REPLACE FUNCTION
--   DROP POLICY IF EXISTS قبل كل CREATE POLICY
-- ==========================================================================

SET search_path TO public;

-- ==========================================================================
-- القسم 0 — NOTIFY مبكر لبدء إعادة تحميل schema cache
-- ==========================================================================

NOTIFY pgrst, 'reload schema';

-- ==========================================================================
-- القسم 1 — إنشاء جدول notifications (يجب أن يكون قبل أي دالة تعتمد عليه)
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    school_id  UUID        REFERENCES public.schools(id) ON DELETE CASCADE,
    type       TEXT        NOT NULL,
    title      TEXT        NOT NULL,
    message    TEXT        NOT NULL,
    is_read    BOOLEAN     NOT NULL DEFAULT false,
    metadata   JSONB       DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies — نفس المعرّفة في 20260903400000_fix_rls_performance_linter.sql
-- نستخدم (SELECT auth.uid()) بدلاً من auth.uid() مباشرة لتحسين الأداء
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select"
    ON public.notifications FOR SELECT TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.user_roles ac
            WHERE ac.user_id        = (SELECT auth.uid())
              AND ac.role            = 'admin'
              AND ac.approval_status = 'approved'
              AND ac.school_id       = notifications.school_id
        )
    );

DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update"
    ON public.notifications FOR UPDATE TO authenticated
    USING     (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;
CREATE POLICY "notifications_delete"
    ON public.notifications FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- منح الصلاحيات على الجدول
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated, service_role;

-- فهارس جدول notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
    ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON public.notifications (user_id, type)
    WHERE is_read = false;

-- إضافة notifications لـ supabase_realtime (مغلّف في DO block لتجنب خطأ إذا كان موجوداً)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'notifications: supabase_realtime — %', SQLERRM;
END;
$$;

-- ==========================================================================
-- القسم 2 — ضمان وجود الأعمدة المفقودة
-- ==========================================================================

-- notification_prefs في profiles
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'profiles'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_prefs JSONB;
        RAISE NOTICE 'profiles.notification_prefs: ensured';
    END IF;
END $$;

-- unread_by_parent في conversations
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'conversations'
    ) THEN
        ALTER TABLE public.conversations
            ADD COLUMN IF NOT EXISTS unread_by_parent INT NOT NULL DEFAULT 0;
        RAISE NOTICE 'conversations.unread_by_parent: ensured';
    END IF;
END $$;

-- ==========================================================================
-- القسم 3 — إعادة تسجيل get_dashboard_stats
--    نسخة كاملة من 20260903100000_fix_slow_rpc_functions.sql
--    Signature: p_school_id UUID, p_is_super_admin BOOLEAN → JSONB
--    Language : sql STABLE SECURITY DEFINER
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
    p_school_id      UUID,
    p_is_super_admin BOOLEAN
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH
    student_count AS (
        SELECT COUNT(*) AS n
        FROM students
        WHERE p_is_super_admin OR school_id = p_school_id
    ),
    class_count AS (
        SELECT COUNT(*) AS n
        FROM classes
        WHERE p_is_super_admin OR school_id = p_school_id
    ),
    fees_totals AS (
        SELECT
            COALESCE(SUM(amount_due),  0) AS total_due,
            COALESCE(SUM(amount_paid), 0) AS total_paid
        FROM fees
        WHERE p_is_super_admin OR school_id = p_school_id
    ),
    roles_stats AS (
        SELECT
            COUNT(*) FILTER (WHERE role = 'teacher' AND approval_status = 'approved') AS teachers,
            COUNT(*) FILTER (WHERE role = 'parent'  AND approval_status = 'approved') AS parents
        FROM user_roles
        WHERE p_is_super_admin OR school_id = p_school_id
    ),
    attendance_today AS (
        SELECT
            COUNT(DISTINCT student_id) FILTER (WHERE status IN ('present', 'late')) AS present_count,
            COUNT(DISTINCT student_id) FILTER (WHERE status = 'absent')             AS absent_count
        FROM attendance
        WHERE (p_is_super_admin OR school_id = p_school_id)
          AND date = CURRENT_DATE
    )
    SELECT jsonb_build_object(
        'students',       sc.n,
        'teachers',       rs.teachers,
        'parents',        rs.parents,
        'classes',        cc.n,
        'totalDue',       ft.total_due,
        'totalPaid',      ft.total_paid,
        'presentToday',   at.present_count,
        'absentToday',    at.absent_count,
        'attendanceRate', CASE WHEN sc.n > 0
                          THEN ROUND((at.present_count::NUMERIC / sc.n::NUMERIC) * 100)
                          ELSE 0 END
    )
    FROM student_count sc,
         class_count   cc,
         fees_totals   ft,
         roles_stats   rs,
         attendance_today at;
$$;

REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats(UUID, BOOLEAN) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_dashboard_stats(UUID, BOOLEAN) TO authenticated, service_role;

-- ==========================================================================
-- القسم 4 — إعادة تسجيل get_admin_dashboard_activities
--    نسخة كاملة من 20260903100000_fix_slow_rpc_functions.sql
--    Signature: p_school_id uuid → jsonb
--    Language : plpgsql STABLE SECURITY DEFINER
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_activities(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller uuid;
BEGIN
    v_caller := auth.uid();

    IF NOT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id        = v_caller
          AND role           = 'admin'
          AND school_id      = p_school_id
          AND approval_status = 'approved'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Admin access required';
    END IF;

    RETURN COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id',          combined.id,
                    'type',        combined.type,
                    'title',       combined.title,
                    'description', combined.description,
                    'date',        combined.date,
                    'status',      combined.status
                )
                ORDER BY combined.date DESC
            )
            FROM (
                -- شكاوى حديثة
                SELECT sub.id, sub.type, sub.title, sub.description, sub.date, sub.status
                FROM (
                    SELECT
                        c.id,
                        'complaint'::text     AS type,
                        'شكوى جديدة'::text    AS title,
                        CASE WHEN length(c.content) > 60
                             THEN substring(c.content FROM 1 FOR 60) || '...'
                             ELSE c.content
                        END                   AS description,
                        c.created_at          AS date,
                        c.status::text        AS status
                    FROM complaints c
                    WHERE c.school_id = p_school_id
                    ORDER BY c.created_at DESC
                    LIMIT 5
                ) sub

                UNION ALL

                -- طلبات انضمام معلقة
                SELECT sub.id, sub.type, sub.title, sub.description, sub.date, sub.status
                FROM (
                    SELECT
                        ur.id,
                        'registration'::text          AS type,
                        'طلب انضمام جديد'::text       AS title,
                        'المستخدم: ' || COALESCE(p.full_name, 'غير معروف') AS description,
                        ur.created_at                 AS date,
                        ur.approval_status::text      AS status
                    FROM user_roles ur
                    LEFT JOIN profiles p ON p.id = ur.user_id
                    WHERE ur.school_id      = p_school_id
                      AND ur.approval_status = 'pending'
                    ORDER BY ur.created_at DESC
                    LIMIT 5
                ) sub

                UNION ALL

                -- مدفوعات رسوم حديثة
                SELECT sub.id, sub.type, sub.title, sub.description, sub.date, sub.status
                FROM (
                    SELECT
                        fp.id,
                        'payment'::text   AS type,
                        'تم دفع رسوم'::text AS title,
                        'المبلغ: ' || fp.amount::text || ' ج.م للطالب ' ||
                        COALESCE(s.name, 'غير معروف') AS description,
                        fp.payment_date   AS date,
                        'success'::text   AS status
                    FROM fee_payments fp
                    JOIN fees     f ON f.id = fp.fee_id
                    JOIN students s ON s.id = f.student_id
                    WHERE fp.school_id = p_school_id
                    ORDER BY fp.payment_date DESC
                    LIMIT 5
                ) sub
            ) combined
            LIMIT 10
        ),
        '[]'::jsonb
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_activities(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_admin_dashboard_activities(uuid) TO authenticated, service_role;

-- ==========================================================================
-- القسم 5 — إعادة تسجيل get_unread_notification_counts
--    نسخة كاملة من 20260903100000_fix_slow_rpc_functions.sql
--    هذه الدالة الآن ستُترجَم بنجاح لأن جدول notifications موجود من القسم 1
--    Signature: p_user_id uuid → jsonb
--    Language : sql STABLE SECURITY DEFINER
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.get_unread_notification_counts(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'unread',     COUNT(*) FILTER (WHERE is_read = false),
        'complaints', COUNT(*) FILTER (WHERE is_read = false AND type LIKE 'complaint%')
    )
    FROM public.notifications
    WHERE user_id = p_user_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_unread_notification_counts(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_unread_notification_counts(uuid) TO authenticated, service_role;

-- ==========================================================================
-- القسم 6 — إعادة تسجيل get_fees_summary
--    نسخة كاملة من 20260807000000_create_get_fees_summary_rpc.sql
--    Signature: p_school_id uuid, p_class_id text DEFAULT NULL,
--               p_term text DEFAULT '' → TABLE(total_due numeric, total_paid numeric)
--    Language : plpgsql SECURITY DEFINER STABLE
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.get_fees_summary(
    p_school_id uuid,
    p_class_id  text DEFAULT NULL::text,
    p_term      text DEFAULT ''::text
)
RETURNS TABLE (
    total_due  numeric,
    total_paid numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
STABLE
AS $$
DECLARE
    v_class_id text;
    v_term     text;
BEGIN
    -- Guard: school_id إلزامي لمنع تسريب البيانات بين المدارس
    IF p_school_id IS NULL THEN
        total_due  := 0;
        total_paid := 0;
        RETURN NEXT;
        RETURN;
    END IF;

    -- تطبيع المعاملات الاختيارية (NULL أو مسافات = "الكل")
    v_class_id := NULLIF(BTRIM(COALESCE(p_class_id, '')), '');
    v_term     := COALESCE(NULLIF(BTRIM(p_term), ''), '');

    -- 1) total_due = مجموع الرسوم الشهرية من جدول students
    SELECT COALESCE(SUM(COALESCE(s.monthly_fee, 0)), 0)::numeric
      INTO total_due
      FROM public.students s
     WHERE s.school_id = p_school_id
       AND (v_class_id IS NULL OR s.class_id = v_class_id);

    -- 2) total_paid = مجموع المدفوعات من جدول fees
    IF v_term = '' THEN
        SELECT COALESCE(SUM(COALESCE(f.amount_paid, 0)), 0)::numeric
          INTO total_paid
          FROM public.fees f
          JOIN public.students s ON s.id = f.student_id
         WHERE f.school_id = p_school_id
           AND s.school_id = p_school_id
           AND (v_class_id IS NULL OR s.class_id = v_class_id);
    ELSE
        SELECT COALESCE(SUM(COALESCE(f.amount_paid, 0)), 0)::numeric
          INTO total_paid
          FROM public.fees f
          JOIN public.students s ON s.id = f.student_id
         WHERE f.school_id = p_school_id
           AND s.school_id = p_school_id
           AND f.term      = v_term
           AND (v_class_id IS NULL OR s.class_id = v_class_id);
    END IF;

    RETURN NEXT;
END;
$$;

REVOKE ALL    ON FUNCTION public.get_fees_summary(uuid, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_fees_summary(uuid, text, text) TO authenticated, service_role;

-- ==========================================================================
-- القسم 7 — NOTIFY نهائي بعد اكتمال جميع التغييرات
-- ==========================================================================

SELECT pg_sleep(0.1);
NOTIFY pgrst, 'reload schema';
