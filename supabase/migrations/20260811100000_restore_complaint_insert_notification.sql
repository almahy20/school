-- ==========================================================================
-- Migration: 20260811100000_restore_complaint_insert_notification.sql
-- Purpose  : Restore the missing INSERT trigger on the complaints table that
--            notifies school admins when a new complaint is submitted.
--
-- Root Cause:
--   • 20260402310000 created tr_handle_complaint_change (INSERT+UPDATE).
--   • 20260809000000 dropped tr_handle_complaint_change to eliminate duplicate
--     UPDATE notifications — but never replaced the INSERT branch.
--   • Result: new complaints appear in the DB but admins receive NO notification
--             and the complaints center page isn't refreshed via realtime.
--
-- Fix:
--   1. Re-create notify_admin_new_complaint() — inserts one notification row
--      per admin in the school when a new complaint is submitted.
--   2. Attach it as tr_notify_admin_new_complaint (AFTER INSERT).
--   3. Fix get_admin_dashboard_activities() to return [] instead of null when
--      the school has no recent activity (COALESCE guard).
-- ==========================================================================

-- ── 1. Restore admin-notification function for new complaints ────────────
CREATE OR REPLACE FUNCTION public.notify_admin_new_complaint()
RETURNS trigger AS $$
DECLARE
    v_admin_id  uuid;
    v_school_id uuid;
BEGIN
    v_school_id := COALESCE(
        NEW.school_id,
        (SELECT school_id FROM public.profiles WHERE id = NEW.parent_id LIMIT 1)
    );

    IF v_school_id IS NULL THEN
        RETURN NEW; -- cannot determine school — skip silently
    END IF;

    FOR v_admin_id IN (
        SELECT user_id
        FROM   public.user_roles
        WHERE  school_id = v_school_id
          AND  role      = 'admin'
    )
    LOOP
        INSERT INTO public.notifications
               (user_id, school_id, type, title, message, metadata)
        VALUES (
            v_admin_id,
            v_school_id,
            'complaint_new',
            'شكوى جديدة من ولي أمر',
            'تم استلام شكوى جديدة: ' || LEFT(COALESCE(NEW.content, 'بدون محتوى'), 60),
            jsonb_build_object(
                'complaint_id', NEW.id,
                'parent_id',    NEW.parent_id,
                'student_id',   NEW.student_id,
                'url',          '/complaints'
            )
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── 2. Attach trigger (idempotent) ──────────────────────────────────────
DROP TRIGGER IF EXISTS tr_notify_admin_new_complaint ON public.complaints;
CREATE TRIGGER tr_notify_admin_new_complaint
    AFTER INSERT ON public.complaints
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_admin_new_complaint();

-- ── 3. Fix get_admin_dashboard_activities to never return NULL ───────────
-- Replaces the function with a COALESCE(..., '[]'::jsonb) guard so that when
-- no data exists the frontend receives an empty array, not null.
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_activities(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Security: only admins of this school may call this function
    IF NOT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id  = auth.uid()
          AND role     = 'admin'
          AND school_id = p_school_id
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Admin access required';
    END IF;

    RETURN COALESCE(
        (
            SELECT jsonb_agg(row_to_json(combined))
            FROM (
                SELECT * FROM (
                    SELECT
                        c.id,
                        'complaint'::text                                   AS type,
                        'شكوى جديدة'::text                                  AS title,
                        CASE
                            WHEN length(c.content) > 60
                            THEN substring(c.content FROM 1 FOR 60) || '...'
                            ELSE c.content
                        END                                                 AS description,
                        c.created_at                                        AS date,
                        c.status::text                                      AS status
                    FROM complaints c
                    WHERE c.school_id = p_school_id
                    ORDER BY c.created_at DESC
                    LIMIT 5
                ) c_sub

                UNION ALL

                SELECT * FROM (
                    SELECT
                        ur.id,
                        'registration'::text                                AS type,
                        'طلب انضمام جديد'::text                             AS title,
                        'المستخدم: ' || COALESCE(p.full_name, 'غير معروف')   AS description,
                        ur.created_at                                       AS date,
                        ur.approval_status::text                            AS status
                    FROM user_roles ur
                    LEFT JOIN profiles p ON p.id = ur.user_id
                    WHERE ur.school_id      = p_school_id
                      AND ur.approval_status = 'pending'
                    ORDER BY ur.created_at DESC
                    LIMIT 5
                ) r_sub

                UNION ALL

                SELECT * FROM (
                    SELECT
                        fp.id,
                        'payment'::text                                     AS type,
                        'تم دفع رسوم'::text                                 AS title,
                        'المبلغ: ' || fp.amount || ' ج.م للطالب ' ||
                            COALESCE(s.name, 'غير معروف')                   AS description,
                        fp.payment_date                                     AS date,
                        'success'::text                                     AS status
                    FROM fee_payments fp
                    JOIN fees     f ON f.id = fp.fee_id
                    JOIN students s ON s.id = f.student_id
                    WHERE fp.school_id = p_school_id
                    ORDER BY fp.payment_date DESC
                    LIMIT 5
                ) p_sub

                ORDER BY date DESC
                LIMIT 10
            ) combined
        ),
        '[]'::jsonb
    );
END;
$$;

-- ── 4. Permissions ───────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.notify_admin_new_complaint() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.notify_admin_new_complaint() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_activities(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_admin_dashboard_activities(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
