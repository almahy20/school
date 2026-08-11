-- ════════════════════════════════════════════════════════════════════════
-- Migration: fix_parent_signup_push_notification
-- Goal: Ensure admins receive a push notification when a parent registers
--       and is placed in the waiting list (pending approval).
--
-- Root cause: The existing notify_admin_new_parent_signup() was inserting
-- into notifications using column `content` which does NOT exist.
-- The actual column name is `message`. This caused the INSERT to fail
-- silently (EXCEPTION block suppressed it), so no notification was stored
-- and therefore no push was fired.
-- ════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- Rebuild notify_admin_new_parent_signup with the correct column name
-- and robust error handling
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_admin_new_parent_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id     uuid;
    v_school_id    uuid;
    v_parent_name  text;
    v_parent_phone text;
BEGIN
    -- Only fire for pending parents with a known school
    IF NEW.role != 'parent' THEN
        RETURN NEW;
    END IF;

    IF NEW.approval_status != 'pending' THEN
        RETURN NEW;
    END IF;

    v_school_id := NEW.school_id;
    IF v_school_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Fetch parent profile info safely
    BEGIN
        SELECT full_name, phone
          INTO v_parent_name, v_parent_phone
          FROM public.profiles
         WHERE id = NEW.user_id;
    EXCEPTION WHEN OTHERS THEN
        v_parent_name  := 'ولي أمر';
        v_parent_phone := 'غير محدد';
    END;

    v_parent_name  := COALESCE(v_parent_name,  'ولي أمر');
    v_parent_phone := COALESCE(v_parent_phone, 'غير محدد');

    -- Notify every approved admin of this school
    FOR v_admin_id IN (
        SELECT user_id
          FROM public.user_roles
         WHERE school_id       = v_school_id
           AND role            = 'admin'
           AND approval_status = 'approved'
    )
    LOOP
        BEGIN
            INSERT INTO public.notifications (
                user_id,
                school_id,
                title,
                message,          -- ← correct column name
                type,
                link
            ) VALUES (
                v_admin_id,
                v_school_id,
                '🔔 طلب انضمام ولي أمر جديد',
                'قام ' || v_parent_name ||
                    ' بتسجيل حساب جديد وينتظر موافقتك.' ||
                    ' رقم الهاتف: ' || v_parent_phone,
                'parent_approval_pending',
                '/parents'
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'notify_admin_new_parent_signup: failed to notify admin % : %',
                          v_admin_id, SQLERRM;
        END;
    END LOOP;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Never fail the parent signup due to notification error
    RAISE WARNING 'notify_admin_new_parent_signup: trigger error: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Rebuild notify_admin_new_teacher_signup with the correct column name
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_admin_new_teacher_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id      uuid;
    v_school_id     uuid;
    v_teacher_name  text;
    v_teacher_phone text;
BEGIN
    IF NEW.role != 'teacher' THEN
        RETURN NEW;
    END IF;

    IF NEW.approval_status != 'pending' THEN
        RETURN NEW;
    END IF;

    v_school_id := NEW.school_id;
    IF v_school_id IS NULL THEN
        RETURN NEW;
    END IF;

    BEGIN
        SELECT full_name, phone
          INTO v_teacher_name, v_teacher_phone
          FROM public.profiles
         WHERE id = NEW.user_id;
    EXCEPTION WHEN OTHERS THEN
        v_teacher_name  := 'معلم';
        v_teacher_phone := 'غير محدد';
    END;

    v_teacher_name  := COALESCE(v_teacher_name,  'معلم');
    v_teacher_phone := COALESCE(v_teacher_phone, 'غير محدد');

    FOR v_admin_id IN (
        SELECT user_id
          FROM public.user_roles
         WHERE school_id       = v_school_id
           AND role            = 'admin'
           AND approval_status = 'approved'
    )
    LOOP
        BEGIN
            INSERT INTO public.notifications (
                user_id,
                school_id,
                title,
                message,
                type,
                link
            ) VALUES (
                v_admin_id,
                v_school_id,
                '🔔 طلب انضمام معلم جديد',
                'قام ' || v_teacher_name ||
                    ' بتسجيل حساب جديد وينتظر موافقتك.' ||
                    ' رقم الهاتف: ' || v_teacher_phone,
                'teacher_approval_pending',
                '/teachers'
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'notify_admin_new_teacher_signup: failed to notify admin % : %',
                          v_admin_id, SQLERRM;
        END;
    END LOOP;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_admin_new_teacher_signup: trigger error: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Re-attach triggers (idempotent)
-- ─────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS tr_notify_admin_new_parent_signup  ON public.user_roles;
CREATE TRIGGER tr_notify_admin_new_parent_signup
    AFTER INSERT ON public.user_roles
    FOR EACH ROW
    WHEN (NEW.role = 'parent' AND NEW.approval_status = 'pending')
    EXECUTE FUNCTION public.notify_admin_new_parent_signup();

DROP TRIGGER IF EXISTS tr_notify_admin_new_teacher_signup ON public.user_roles;
CREATE TRIGGER tr_notify_admin_new_teacher_signup
    AFTER INSERT ON public.user_roles
    FOR EACH ROW
    WHEN (NEW.role = 'teacher' AND NEW.approval_status = 'pending')
    EXECUTE FUNCTION public.notify_admin_new_teacher_signup();

-- ─────────────────────────────────────────────────────────────────────────
-- Revoke EXECUTE from user roles (internal trigger functions)
-- (Hardening — should not be callable from REST API)
-- ─────────────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.notify_admin_new_parent_signup()
    FROM public, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.notify_admin_new_teacher_signup()
    FROM public, anon, authenticated;
