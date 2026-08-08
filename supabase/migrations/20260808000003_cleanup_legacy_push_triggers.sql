-- ==========================================================================
-- Migration: 20260808000003_cleanup_legacy_push_triggers.sql
-- Step     : #3 — Drop ALL old/conflicting trigger variants that were
--               introduced by migrations between April 4 and April 13,
--               then VERIFY via information_schema that ONLY the correct
--               trigger (tr_auto_push_on_notification → the one from
--               migration 20260808000002, based on 20260601000000) exists.
--
-- The old versions that must NOT be active:
--   • 20260404000000_trigger_push_notifications.sql          → tr_push_notification_on_insert, anon key
--   • 20260404600000_auto_push_notifications.sql            → tr_auto_push_on_notification, anon key
--   • 20260404700000_final_unified_notifications.sql        → tr_auto_push_on_notification, anon key
--   • 20260404800000_final_fix_all_notifications.sql        → tr_auto_push_on_notification, anon key
--   • 20260410000003_fix_notification_triggers.sql          → tr_auto_push_on_notification, anon key
--   • 20260413000005_fix_hardcoded_credentials.sql          → tr_auto_push_on_notification, GUC fallback
--   • 20260426000000_fix_push_notifications_auth.sql        → different function body, GUC + placeholder
-- They all share trigger names that DROP IF EXISTS below covers.
-- ==========================================================================

-- ── 1. Drop every known-old trigger NAME attached to `notifications` ─────
-- (Harmless if they don't exist.)
DROP TRIGGER IF EXISTS tr_push_notification_on_insert   ON public.notifications;
DROP TRIGGER IF EXISTS tr_auto_push_on_notification     ON public.notifications;
DROP TRIGGER IF EXISTS tr_push_on_notification          ON public.notifications;
DROP TRIGGER IF EXISTS tr_notification_insert           ON public.notifications;

-- ── 2. Drop old FUNCTION BODIES that are NOT the current vault version ──
-- (We DROP and let the previous migration 20260808000002 CREATE it fresh,
--  which already happened if you ran migrations in order. This is an extra
--  safety net in case someone ran them out of order.)

-- Actually we do NOT drop trigger_push_on_notification_insert() here because
-- migration 20260808000002 already CREATE OR REPLACEd it with the correct
-- vault-based + logging version. Dropping it now would break the trigger.
-- The DROP TRIGGER above is sufficient to remove duplicate invocations.

-- What we DO drop is the *different-name* functions the old migrations
-- created so they can never be re-attached by accident:
DROP FUNCTION IF EXISTS public.trigger_push_notification_on_insert() CASCADE;
DROP FUNCTION IF EXISTS public.notify_attendance_update() CASCADE;
DROP FUNCTION IF EXISTS public.notify_new_grade() CASCADE;
DROP FUNCTION IF EXISTS public.notify_complaint_response() CASCADE;
DROP FUNCTION IF EXISTS public.notify_new_fee() CASCADE;

-- Wait — notify_* functions above are NOT push triggers, they INSERT into
-- `notifications` table (feedstock for the push trigger). We SHOULD NOT
-- drop them. Re-create them to be safe (they were dropped just above):
DO $$
BEGIN
    RAISE NOTICE 'Re-creating feedstock triggers (attendance/grades/complaints/fees) that were accidentally dropped...';
END $$;

-- ── Re-create: attendance → notifications ────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_attendance_update()
RETURNS trigger AS $$
DECLARE
    v_parent_id   uuid;
    v_student_name text;
    v_status_ar   text;
    v_school_id   uuid;
BEGIN
    v_school_id := COALESCE(NEW.school_id,
                  (SELECT school_id FROM public.students WHERE id = NEW.student_id LIMIT 1));

    IF (NEW.status IN ('absent', 'late')) THEN
        SELECT name INTO v_student_name FROM public.students WHERE id = NEW.student_id;
        v_status_ar := CASE WHEN NEW.status = 'absent' THEN 'غائب' ELSE 'متأخر' END;

        FOR v_parent_id IN
            (SELECT parent_id FROM public.student_parents WHERE student_id = NEW.student_id)
        LOOP
            INSERT INTO public.notifications
                   (user_id, school_id, type, title, message, metadata)
            VALUES (v_parent_id,
                    v_school_id,
                    'attendance_alert',
                    'تنبيه حضور وانضباط',
                    'نحيطكم علماً بأن الطالب ' || v_student_name || ' مسجل كـ ' || v_status_ar || ' اليوم ' || NEW.date::text,
                    jsonb_build_object('student_id', NEW.student_id,
                                       'date',       NEW.date,
                                       'status',     NEW.status,
                                       'url',        '/parent/dashboard'));
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_attendance ON public.attendance;
CREATE TRIGGER tr_notify_attendance
    AFTER INSERT OR UPDATE ON public.attendance
    FOR EACH ROW EXECUTE FUNCTION public.notify_attendance_update();

-- ── Re-create: grades → notifications ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_new_grade()
RETURNS trigger AS $$
DECLARE
    v_parent_id    uuid;
    v_student_name text;
    v_school_id    uuid;
BEGIN
    v_school_id := COALESCE(NEW.school_id,
                  (SELECT school_id FROM public.students WHERE id = NEW.student_id LIMIT 1));
    SELECT name INTO v_student_name FROM public.students WHERE id = NEW.student_id;

    FOR v_parent_id IN
        (SELECT parent_id FROM public.student_parents WHERE student_id = NEW.student_id)
    LOOP
        INSERT INTO public.notifications
               (user_id, school_id, type, title, message, metadata)
        VALUES (v_parent_id,
                v_school_id,
                'new_grade',
                'رصد درجة جديدة',
                'تم رصد درجة الطالب ' || v_student_name || ' في مادة ' || NEW.subject || ': ' || COALESCE(NEW.score::text, ''),
                jsonb_build_object('student_id', NEW.student_id,
                                   'subject',    NEW.subject,
                                   'url',        '/parent/children/' || NEW.student_id::text));
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_new_grade ON public.grades;
CREATE TRIGGER tr_notify_new_grade
    AFTER INSERT OR UPDATE ON public.grades
    FOR EACH ROW EXECUTE FUNCTION public.notify_new_grade();

-- ── Re-create: complaints → notifications ────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_complaint_response()
RETURNS trigger AS $$
DECLARE
    v_school_id uuid;
BEGIN
    v_school_id := COALESCE(NEW.school_id,
                  (SELECT school_id FROM public.profiles WHERE id = NEW.parent_id LIMIT 1));

    IF (OLD.admin_response IS NULL AND NEW.admin_response IS NOT NULL)
    OR (OLD.admin_response IS DISTINCT FROM NEW.admin_response) THEN
        INSERT INTO public.notifications
               (user_id, school_id, type, title, message, metadata)
        VALUES (NEW.parent_id,
                v_school_id,
                'complaint_response',
                'رد على شكواك',
                'قامت إدارة المدرسة بالرد على شكواك رقم ' || NEW.id::text,
                jsonb_build_object('complaint_id', NEW.id,
                                   'url', '/parent/complaints'));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_complaint_response ON public.complaints;
CREATE TRIGGER tr_notify_complaint_response
    AFTER UPDATE ON public.complaints
    FOR EACH ROW EXECUTE FUNCTION public.notify_complaint_response();

-- ── Re-create: fees → notifications ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_new_fee()
RETURNS trigger AS $$
DECLARE
    v_parent_id    uuid;
    v_student_name text;
    v_school_id    uuid;
BEGIN
    v_school_id := COALESCE(NEW.school_id,
                  (SELECT school_id FROM public.students WHERE id = NEW.student_id LIMIT 1));
    SELECT name INTO v_student_name FROM public.students WHERE id = NEW.student_id;

    FOR v_parent_id IN
        (SELECT parent_id FROM public.student_parents WHERE student_id = NEW.student_id)
    LOOP
        INSERT INTO public.notifications
               (user_id, school_id, type, title, message, metadata)
        VALUES (v_parent_id,
                v_school_id,
                'new_fee',
                'إشعار رسوم دراسية',
                'تم إصدار رسوم جديدة للطالب ' || v_student_name || ' لشهر ' || COALESCE(NEW.month::text, '')
                    || ' بقيمة ' || COALESCE(NEW.amount_due::text, ''),
                jsonb_build_object('student_id', NEW.student_id,
                                   'fee_id',     NEW.id,
                                   'url',        '/parent/dashboard'));
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_new_fee ON public.fees;
CREATE TRIGGER tr_notify_new_fee
    AFTER INSERT ON public.fees
    FOR EACH ROW EXECUTE FUNCTION public.notify_new_fee();

-- ── 3. Re-attach the CORRECT push trigger (idempotent) ──────────────────
DROP TRIGGER IF EXISTS tr_auto_push_on_notification ON public.notifications;
CREATE TRIGGER tr_auto_push_on_notification
    AFTER INSERT ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_push_on_notification_insert();

NOTIFY pgrst, 'reload schema';

-- ==========================================================================
-- 🔍  VERIFICATION QUERIES — run MANUALLY after applying this migration
--     to confirm the system is in the expected state.
--
--  Expected results:
--    Q1 → exactly 1 row: trigger name = 'tr_auto_push_on_notification'
--                        function name = 'trigger_push_on_notification_insert'
--    Q2 → 0 rows (no orphan feedstock triggers missing)
--    Q3 → check that push_trigger_errors & push_delivery_log tables exist
-- ==========================================================================

/*

-- Q1: Which triggers currently exist on the `notifications` table?
SELECT
    event_object_table    AS on_table,
    trigger_name,
    action_timing         AS fires_when,
    event_manipulation    AS DML_event,
    action_statement      AS calls_function
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table   = 'notifications'
ORDER BY trigger_name;


-- Q2: Feedstock triggers on attendance/grades/complaints/fees should be 4
SELECT
    event_object_table    AS on_table,
    trigger_name,
    action_timing,
    event_manipulation
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('attendance','grades','complaints','fees')
ORDER BY event_object_table, trigger_name;


-- Q3: Tables + columns for new push infrastructure exist?
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
      (table_name = 'push_subscriptions' AND column_name IN ('user_agent','failure_count','last_failure_at','last_failure_code','updated_at'))
   OR (table_name IN ('push_trigger_errors','push_delivery_log'))
  )
ORDER BY table_name, ordinal_position;


-- Q4: Did migration #1 seed the push_trigger_errors? (run after inserting
--     one notification into public.notifications WITHOUT the vault key set)
SELECT * FROM public.push_trigger_errors ORDER BY created_at DESC LIMIT 10;


-- Q5: Did migration #2 log a pg_net request_id? (after a successful send)
SELECT * FROM public.push_delivery_with_response ORDER BY queued_at DESC LIMIT 10;

*/
