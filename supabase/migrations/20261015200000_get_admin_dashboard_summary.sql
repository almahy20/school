-- Migration: Combined Admin Dashboard Summary (Stats + Activities) in ONE single RPC
-- Preserves existing get_dashboard_stats and get_admin_dashboard_activities functions.

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_summary(
    p_school_id  UUID,
    p_caller_id  UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
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
    -- 1. Identify caller identity
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

    -- 2. Verify authorization: user must belong to this school as approved admin, or be super admin
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

    -- 3. Calculate statistics (Stats)
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

    -- 4. Fetch recent dashboard activities
    SELECT COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', combined.id, 'type', combined.type,
                    'title', combined.title, 'description', combined.description,
                    'date', combined.date, 'status', combined.status
                )
                ORDER BY combined.date DESC
            )
            FROM (
                SELECT sub.id, sub.type, sub.title, sub.description, sub.date, sub.status
                FROM (
                    SELECT c.id, 'complaint'::text AS type, 'شكوى جديدة'::text AS title,
                        CASE WHEN length(c.content) > 60 THEN substring(c.content FROM 1 FOR 60)||'...' ELSE c.content END AS description,
                        c.created_at AS date, c.status::text AS status
                    FROM complaints c WHERE c.school_id = p_school_id
                    ORDER BY c.created_at DESC LIMIT 5
                ) sub
                UNION ALL
                SELECT sub.id, sub.type, sub.title, sub.description, sub.date, sub.status
                FROM (
                    SELECT ur.id, 'registration'::text AS type, 'طلب انضمام جديد'::text AS title,
                        'المستخدم: ' || COALESCE(p.full_name, 'غير معروف') AS description,
                        ur.created_at AS date, ur.approval_status::text AS status
                    FROM user_roles ur LEFT JOIN profiles p ON p.id = ur.user_id
                    WHERE ur.school_id = p_school_id AND ur.approval_status = 'pending'
                    ORDER BY ur.created_at DESC LIMIT 5
                ) sub
                UNION ALL
                SELECT sub.id, sub.type, sub.title, sub.description, sub.date, sub.status
                FROM (
                    SELECT fp.id, 'payment'::text AS type, 'تم دفع رسوم'::text AS title,
                        'المبلغ: ' || fp.amount::text || ' ج.م للطالب ' || COALESCE(s.name, 'غير معروف') AS description,
                        fp.payment_date AS date, 'success'::text AS status
                    FROM fee_payments fp JOIN fees f ON f.id = fp.fee_id JOIN students s ON s.id = f.student_id
                    WHERE fp.school_id = p_school_id ORDER BY fp.payment_date DESC LIMIT 5
                ) sub
            ) combined LIMIT 10
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

REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_summary(UUID, UUID) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_admin_dashboard_summary(UUID, UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
