-- Migration: Fix admin dashboard activities & summary functions by replacing dropped 'complaints' table reference
-- Reason: The 'complaints' table was dropped in migration 20260926184500 (superseded by 'conversations').
--         Calling get_admin_dashboard_summary or get_admin_dashboard_activities throws:
--         "relation 'complaints' does not exist" (PostgREST 404 / 42P01).
-- Changes:
--   1. Replace complaints query with conversations query in public.get_admin_dashboard_summary
--   2. Replace complaints query with conversations query in public.get_admin_dashboard_activities (legacy fallback RPC)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. get_admin_dashboard_summary (Combined Stats + Activities)
-- ─────────────────────────────────────────────────────────────────────────────
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

    -- 2. Verify authorization
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

    -- 4. Fetch recent dashboard activities (replacing dropped complaints with conversations)
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
                    SELECT c.id, 'conversation'::text AS type, 'محادثة أو استفسار جديد'::text AS title,
                        COALESCE(
                            CASE WHEN length(c.last_message_preview) > 60 THEN substring(c.last_message_preview FROM 1 FOR 60) || '...' ELSE c.last_message_preview END,
                            c.subject
                        ) AS description,
                        c.created_at AS date, c.status::text AS status
                    FROM conversations c WHERE c.school_id = p_school_id
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. get_admin_dashboard_activities (Legacy Fallback RPC)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_activities(
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
    v_caller   UUID;
    v_is_admin BOOLEAN := FALSE;
BEGIN
    v_caller := COALESCE(p_caller_id, auth.uid());

    IF v_caller IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id         = v_caller
              AND role            = 'admin'
              AND school_id       = p_school_id
              AND approval_status = 'approved'
        ) INTO v_is_admin;
    END IF;

    IF NOT v_is_admin THEN
        RETURN '[]'::jsonb;
    END IF;

    RETURN COALESCE(
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
                    SELECT c.id, 'conversation'::text AS type, 'محادثة أو استفسار جديد'::text AS title,
                        COALESCE(
                            CASE WHEN length(c.last_message_preview) > 60 THEN substring(c.last_message_preview FROM 1 FOR 60) || '...' ELSE c.last_message_preview END,
                            c.subject
                        ) AS description,
                        c.created_at AS date, c.status::text AS status
                    FROM conversations c WHERE c.school_id = p_school_id
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
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_activities(UUID, UUID) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_admin_dashboard_activities(UUID, UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
