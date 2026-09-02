SET search_path TO public;

-- نُضيف parameter جديد p_caller_id بدلاً من الاعتماد على auth.uid()
-- الدالة القديمة تبقى موجودة (ستُستبدل بـ CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_activities(
    p_school_id  uuid,
    p_caller_id  uuid DEFAULT NULL  -- ← parameter جديد اختياري
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller   uuid;
    v_is_admin boolean := false;
BEGIN
    -- استخدام p_caller_id إذا أُرسل، وإلا نستخدم auth.uid()
    v_caller := COALESCE(p_caller_id, auth.uid());

    IF v_caller IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id        = v_caller
              AND role           = 'admin'
              AND school_id      = p_school_id
              AND approval_status = 'approved'
        ) INTO v_is_admin;
    END IF;

    -- إعادة مصفوفة فارغة بدل exception إذا لم يكن admin
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
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_activities(uuid, uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_admin_dashboard_activities(uuid, uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
