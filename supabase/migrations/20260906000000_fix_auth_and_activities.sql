-- ==========================================================================
-- Migration: 20260906000000_fix_auth_and_activities.sql
-- Purpose  : إصلاح مشكلتين محددتين:
--
--   1. "Unauthorized: Admin access required" في get_admin_dashboard_activities
--      السبب: STABLE function + SECURITY DEFINER → auth.uid() غير موثوق
--      الإصلاح: إعادة تعريف الدالة بـ VOLATILE
--
--   2. "column reference user_id is ambiguous" عند POST /auth/v1/token
--      السبب: notify_admin_new_parent_signup و notify_admin_new_teacher_signup
--             يُدخلان أعمدة (content, link) غير موجودة في جدول notifications
--             الذي يحتوي على (message, metadata)
--      الإصلاح: إعادة تعريف الدالتين بالأعمدة الصحيحة
--
-- Idempotency: آمن للتطبيق أكثر من مرة
--   CREATE OR REPLACE FUNCTION
--   DROP TRIGGER IF EXISTS قبل كل CREATE TRIGGER
-- ==========================================================================

SET search_path TO public;

-- ==========================================================================
-- الإصلاح 1: get_admin_dashboard_activities → VOLATILE بدلاً من STABLE
-- Body مطابق تماماً لـ 20260904000000_force_schema_cache_reload.sql
-- الفرق الوحيد: VOLATILE بدلاً من STABLE
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_activities(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
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
-- الإصلاح 2a: notify_admin_new_parent_signup
-- الأعمدة المُصلَحة: content → message، link → metadata
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.notify_admin_new_parent_signup()
RETURNS TRIGGER AS $$
DECLARE
    v_admin_id     uuid;
    v_school_id    uuid;
    v_parent_name  text;
    v_parent_phone text;
BEGIN
    v_school_id := NEW.school_id;

    IF v_school_id IS NULL THEN
        RETURN NEW;
    END IF;

    BEGIN
        SELECT full_name, phone INTO v_parent_name, v_parent_phone
        FROM public.profiles
        WHERE id = NEW.user_id;
    EXCEPTION WHEN OTHERS THEN
        v_parent_name  := 'ولي أمر';
        v_parent_phone := 'غير محدد';
    END;

    IF NEW.approval_status != 'pending' THEN
        RETURN NEW;
    END IF;

    FOR v_admin_id IN (
        SELECT ur.user_id FROM public.user_roles ur
        WHERE ur.school_id      = v_school_id
          AND ur.role            = 'admin'
          AND ur.approval_status = 'approved'
    ) LOOP
        BEGIN
            INSERT INTO public.notifications (user_id, school_id, type, title, message, metadata)
            VALUES (
                v_admin_id,
                v_school_id,
                'parent_approval_pending',
                'طلب انضمام ولي أمر جديد',
                'قام ' || COALESCE(v_parent_name, 'ولي أمر') || ' بتسجيل حساب جديد ويرتبط انتظار موافقتك. رقم الهاتف: ' || COALESCE(v_parent_phone, 'غير محدد'),
                jsonb_build_object('url', '/parents', 'parent_id', NEW.user_id)
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'notify_admin_new_parent_signup: %', SQLERRM;
        END;
    END LOOP;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_admin_new_parent_signup outer: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==========================================================================
-- الإصلاح 2b: notify_admin_new_teacher_signup
-- الأعمدة المُصلَحة: content → message، link → metadata
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.notify_admin_new_teacher_signup()
RETURNS TRIGGER AS $$
DECLARE
    v_admin_id      uuid;
    v_school_id     uuid;
    v_teacher_name  text;
    v_teacher_phone text;
BEGIN
    v_school_id := NEW.school_id;

    IF v_school_id IS NULL THEN
        RETURN NEW;
    END IF;

    BEGIN
        SELECT full_name, phone INTO v_teacher_name, v_teacher_phone
        FROM public.profiles
        WHERE id = NEW.user_id;
    EXCEPTION WHEN OTHERS THEN
        v_teacher_name  := 'معلم';
        v_teacher_phone := 'غير محدد';
    END;

    IF NEW.approval_status != 'pending' THEN
        RETURN NEW;
    END IF;

    FOR v_admin_id IN (
        SELECT ur.user_id FROM public.user_roles ur
        WHERE ur.school_id      = v_school_id
          AND ur.role            = 'admin'
          AND ur.approval_status = 'approved'
    ) LOOP
        BEGIN
            INSERT INTO public.notifications (user_id, school_id, type, title, message, metadata)
            VALUES (
                v_admin_id,
                v_school_id,
                'teacher_approval_pending',
                'طلب انضمام معلم جديد',
                'قام ' || COALESCE(v_teacher_name, 'معلم') || ' بتسجيل حساب جديد ويرتبط انتظار موافقتك. رقم الهاتف: ' || COALESCE(v_teacher_phone, 'غير محدد'),
                jsonb_build_object('url', '/teachers', 'teacher_id', NEW.user_id)
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'notify_admin_new_teacher_signup: %', SQLERRM;
        END;
    END LOOP;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_admin_new_teacher_signup outer: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==========================================================================
-- إعادة ربط الـ triggers بعد إعادة تعريف الدوال
-- ==========================================================================

DROP TRIGGER IF EXISTS tr_notify_new_parent ON public.user_roles;
CREATE TRIGGER tr_notify_new_parent
    AFTER INSERT ON public.user_roles
    FOR EACH ROW
    WHEN (NEW.role = 'parent' AND NEW.approval_status = 'pending')
    EXECUTE FUNCTION public.notify_admin_new_parent_signup();

DROP TRIGGER IF EXISTS tr_notify_new_teacher ON public.user_roles;
CREATE TRIGGER tr_notify_new_teacher
    AFTER INSERT ON public.user_roles
    FOR EACH ROW
    WHEN (NEW.role = 'teacher' AND NEW.approval_status = 'pending')
    EXECUTE FUNCTION public.notify_admin_new_teacher_signup();

-- ==========================================================================
-- إعادة تحميل schema cache
-- ==========================================================================

NOTIFY pgrst, 'reload schema';
