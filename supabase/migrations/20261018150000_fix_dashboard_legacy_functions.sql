-- Migration: 20261018150000_fix_dashboard_legacy_functions.sql
-- Description: Fix get_admin_dashboard_summary_legacy & get_admin_dashboard_activities_legacy
-- 
-- Changes:
--   1. Fix 42P01 error ("relation 'complaints' does not exist") by replacing dropped complaints with conversations.
--   2. Preserve last_message_preview with fallback to subject in activity description.
--   3. Apply ORDER BY date DESC LIMIT 10 on combined itself before jsonb_agg for accurate, deterministic sorting.
--   4. Allow is_super_admin in get_admin_dashboard_activities_legacy identical to summary_legacy.
--   5. Security Hardening: REVOKE EXECUTE from public, anon, authenticated and keep GRANT ONLY to service_role,
--      ensuring legacy functions can only be executed internally via the SECURITY DEFINER wrapper functions
--      (public.get_admin_dashboard_summary and public.get_admin_dashboard_activities).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. get_admin_dashboard_activities_legacy
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_activities_legacy(
    p_school_id  UUID,
    p_caller_id  UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller        UUID;
    v_is_authorized BOOLEAN := FALSE;
    v_is_super      BOOLEAN := FALSE;
BEGIN
    v_caller := COALESCE(p_caller_id, auth.uid());

    IF v_caller IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    -- التحقق من الصلاحيات: السماح للأدمن المعتمد أو السوبر أدمن
    SELECT 
        COALESCE(bool_or(is_super_admin), false),
        COALESCE(bool_or(role = 'admin' AND school_id = p_school_id AND approval_status = 'approved'), false)
    INTO v_is_super, v_is_authorized
    FROM user_roles
    WHERE user_id = v_caller;

    IF NOT (v_is_super OR v_is_authorized) THEN
        RETURN '[]'::jsonb;
    END IF;

    RETURN COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', ordered_activities.id,
                    'type', ordered_activities.type,
                    'title', ordered_activities.title,
                    'description', ordered_activities.description,
                    'date', ordered_activities.date,
                    'status', ordered_activities.status
                )
            )
            FROM (
                SELECT combined.id, combined.type, combined.title, combined.description, combined.date, combined.status
                FROM (
                    -- 1. أحدث المحادثات من أولياء الأمور (بديل الشكاوى)
                    SELECT sub.id, sub.type, sub.title, sub.description, sub.date, sub.status
                    FROM (
                        SELECT 
                            conv.id, 
                            'conversation'::text AS type, 
                            'محادثة جديدة'::text AS title,
                            COALESCE(
                                CASE 
                                    WHEN length(conv.last_message_preview) > 60 THEN substring(conv.last_message_preview FROM 1 FOR 60) || '...' 
                                    ELSE conv.last_message_preview 
                                END,
                                conv.subject
                            ) AS description,
                            conv.created_at AS date, 
                            conv.status::text AS status
                        FROM conversations conv 
                        WHERE conv.school_id = p_school_id
                        ORDER BY conv.created_at DESC 
                        LIMIT 5
                    ) sub

                    UNION ALL

                    -- 2. طلبات الانضمام الجديدة المعلقة
                    SELECT sub.id, sub.type, sub.title, sub.description, sub.date, sub.status
                    FROM (
                        SELECT 
                            ur.id, 
                            'registration'::text AS type, 
                            'طلب انضمام جديد'::text AS title,
                            'المستخدم: ' || COALESCE(p.full_name, 'غير معروف') AS description,
                            ur.created_at AS date, 
                            ur.approval_status::text AS status
                        FROM user_roles ur 
                        LEFT JOIN profiles p ON p.id = ur.user_id
                        WHERE ur.school_id = p_school_id 
                          AND ur.approval_status = 'pending'
                        ORDER BY ur.created_at DESC 
                        LIMIT 5
                    ) sub

                    UNION ALL

                    -- 3. آخر عمليات دفع الرسوم المكتملة
                    SELECT sub.id, sub.type, sub.title, sub.description, sub.date, sub.status
                    FROM (
                        SELECT 
                            fp.id, 
                            'payment'::text AS type, 
                            'تم دفع رسوم'::text AS title,
                            'المبلغ: ' || fp.amount::text || ' ج.م للطالب ' || COALESCE(s.name, 'غير معروف') AS description,
                            fp.payment_date AS date, 
                            'success'::text AS status
                        FROM fee_payments fp 
                        JOIN fees f ON f.id = fp.fee_id 
                        JOIN students s ON s.id = f.student_id
                        WHERE fp.school_id = p_school_id 
                        ORDER BY fp.payment_date DESC 
                        LIMIT 5
                    ) sub
                ) combined
                ORDER BY combined.date DESC
                LIMIT 10
            ) ordered_activities
        ),
        '[]'::jsonb
    );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. get_admin_dashboard_summary_legacy
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_summary_legacy(
    p_school_id  UUID,
    p_caller_id  UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller        UUID;
    v_is_authorized BOOLEAN := FALSE;
    v_is_super      BOOLEAN := FALSE;
    v_stats         JSONB;
    v_activities    JSONB;
BEGIN
    v_caller := COALESCE(p_caller_id, auth.uid());

    IF v_caller IS NULL THEN
        RETURN jsonb_build_object(
            'stats', jsonb_build_object(
                'students', 0, 'teachers', 0, 'parents', 0, 'classes', 0,
                'totalDue', 0, 'totalPaid', 0, 'presentToday', 0, 'absentToday', 0, 'attendanceRate', 0
            ),
            'activities', '[]'::jsonb
        );
    END IF;

    -- التحقق من الصلاحيات: السماح للأدمن المعتمد أو السوبر أدمن
    SELECT 
        COALESCE(bool_or(is_super_admin), false),
        COALESCE(bool_or(role = 'admin' AND school_id = p_school_id AND approval_status = 'approved'), false)
    INTO v_is_super, v_is_authorized
    FROM user_roles
    WHERE user_id = v_caller;

    IF NOT (v_is_super OR v_is_authorized) THEN
        RETURN jsonb_build_object(
            'stats', jsonb_build_object(
                'students', 0, 'teachers', 0, 'parents', 0, 'classes', 0,
                'totalDue', 0, 'totalPaid', 0, 'presentToday', 0, 'absentToday', 0, 'attendanceRate', 0
            ),
            'activities', '[]'::jsonb
        );
    END IF;

    -- حساب الإحصائيات (Stats)
    WITH
    student_count AS (
        SELECT COUNT(*) AS n
        FROM students
        WHERE v_is_super OR school_id = p_school_id
    ),
    class_count AS (
        SELECT COUNT(*) AS n
        FROM classes
        WHERE v_is_super OR school_id = p_school_id
    ),
    fees_totals AS (
        SELECT
            COALESCE(SUM(amount_due),  0) AS total_due,
            COALESCE(SUM(amount_paid), 0) AS total_paid
        FROM fees
        WHERE v_is_super OR school_id = p_school_id
    ),
    roles_stats AS (
        SELECT
            COUNT(*) FILTER (WHERE role = 'teacher' AND approval_status = 'approved') AS teachers,
            COUNT(*) FILTER (WHERE role = 'parent'  AND approval_status = 'approved') AS parents
        FROM user_roles
        WHERE v_is_super OR school_id = p_school_id
    ),
    attendance_today AS (
        SELECT
            COUNT(DISTINCT student_id) FILTER (WHERE status IN ('present', 'late')) AS present_count,
            COUNT(DISTINCT student_id) FILTER (WHERE status = 'absent')             AS absent_count
        FROM attendance
        WHERE (v_is_super OR school_id = p_school_id)
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
    INTO v_stats
    FROM student_count sc,
         class_count   cc,
         fees_totals   ft,
         roles_stats   rs,
         attendance_today at;

    -- جلب الأنشطة الأخيرة مع استبدال جدول complaints بـ conversations
    SELECT COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', ordered_activities.id,
                    'type', ordered_activities.type,
                    'title', ordered_activities.title,
                    'description', ordered_activities.description,
                    'date', ordered_activities.date,
                    'status', ordered_activities.status
                )
            )
            FROM (
                SELECT combined.id, combined.type, combined.title, combined.description, combined.date, combined.status
                FROM (
                    -- 1. أحدث المحادثات من أولياء الأمور
                    SELECT sub.id, sub.type, sub.title, sub.description, sub.date, sub.status
                    FROM (
                        SELECT 
                            conv.id, 
                            'conversation'::text AS type, 
                            'محادثة جديدة'::text AS title,
                            COALESCE(
                                CASE 
                                    WHEN length(conv.last_message_preview) > 60 THEN substring(conv.last_message_preview FROM 1 FOR 60) || '...' 
                                    ELSE conv.last_message_preview 
                                END,
                                conv.subject
                            ) AS description,
                            conv.created_at AS date, 
                            conv.status::text AS status
                        FROM conversations conv 
                        WHERE conv.school_id = p_school_id
                        ORDER BY conv.created_at DESC 
                        LIMIT 5
                    ) sub

                    UNION ALL

                    -- 2. طلبات الانضمام الجديدة المعلقة
                    SELECT sub.id, sub.type, sub.title, sub.description, sub.date, sub.status
                    FROM (
                        SELECT 
                            ur.id, 
                            'registration'::text AS type, 
                            'طلب انضمام جديد'::text AS title,
                            'المستخدم: ' || COALESCE(p.full_name, 'غير معروف') AS description,
                            ur.created_at AS date, 
                            ur.approval_status::text AS status
                        FROM user_roles ur 
                        LEFT JOIN profiles p ON p.id = ur.user_id
                        WHERE ur.school_id = p_school_id 
                          AND ur.approval_status = 'pending'
                        ORDER BY ur.created_at DESC 
                        LIMIT 5
                    ) sub

                    UNION ALL

                    -- 3. آخر عمليات دفع الرسوم المكتملة
                    SELECT sub.id, sub.type, sub.title, sub.description, sub.date, sub.status
                    FROM (
                        SELECT 
                            fp.id, 
                            'payment'::text AS type, 
                            'تم دفع رسوم'::text AS title,
                            'المبلغ: ' || fp.amount::text || ' ج.م للطالب ' || COALESCE(s.name, 'غير معروف') AS description,
                            fp.payment_date AS date, 
                            'success'::text AS status
                        FROM fee_payments fp 
                        JOIN fees f ON f.id = fp.fee_id 
                        JOIN students s ON s.id = f.student_id
                        WHERE fp.school_id = p_school_id 
                        ORDER BY fp.payment_date DESC 
                        LIMIT 5
                    ) sub
                ) combined
                ORDER BY combined.date DESC
                LIMIT 10
            ) ordered_activities
        ),
        '[]'::jsonb
    )
    INTO v_activities;

    RETURN jsonb_build_object(
        'stats', v_stats,
        'activities', v_activities
    );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Permissions & Access Control (Security Hardening)
-- ─────────────────────────────────────────────────────────────────────────────
-- حصر صلاحيات التنفيذ لـ service_role فقط ومنع الوصول المباشر من authenticated أو anon
-- يتم الوصول إلى هاتين الدالتين حصراً عبر الدالتين الوسيطتين SECURITY DEFINER:
--   - public.get_admin_dashboard_summary
--   - public.get_admin_dashboard_activities
REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_activities_legacy(UUID, UUID) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_admin_dashboard_activities_legacy(UUID, UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_summary_legacy(UUID, UUID) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_admin_dashboard_summary_legacy(UUID, UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
