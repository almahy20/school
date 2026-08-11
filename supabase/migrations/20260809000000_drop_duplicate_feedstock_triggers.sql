-- ==========================================================================
-- Migration: 20260809000000_drop_duplicate_feedstock_triggers.sql
-- Purpose  : Remove duplicate feedstock triggers that cause double (or triple)
--            inserts into the notifications table.
--
-- Confirmed state on DB before this migration:
--   grades     → tr_new_grade_added (INSERT)   + tr_notify_new_grade (INSERT+UPDATE)
--   complaints → tr_handle_complaint_change (INSERT+UPDATE)
--              + tr_notify_complaint_response (UPDATE)
--              + tr_notify_complaint_update (UPDATE)
--   attendance → tr_notify_attendance (INSERT+UPDATE)  ← correct, untouched
--
-- What this migration does:
--   1. grades    : DROP tr_new_grade_added + on_new_grade_added()
--                  KEEP tr_notify_new_grade  (newest, has student name + score + school_id fallback)
--   2. complaints: DROP tr_handle_complaint_change + handle_complaint_change()
--                  DROP tr_notify_complaint_update  + notify_complaint_update()
--                  KEEP tr_notify_complaint_response (newest, type='complaint_response')
--                  ADD  tr_notify_complaint_status_change — narrow trigger for
--                       status-only changes (no admin_response change), so we
--                       don't lose the coverage handle_complaint_change provided.
--
-- What this migration does NOT touch:
--   • push_subscriptions
--   • push_trigger_errors
--   • push_delivery_log
--   • tr_auto_push_on_notification
--   • trigger_push_on_notification_insert()
--   • tr_notify_attendance / notify_attendance_update()
--   • tr_notify_new_fee / notify_new_fee()
--   • tr_notify_new_message / notify_new_message()
-- ==========================================================================


-- ── 1. GRADES: drop legacy trigger ────────────────────────────────────────
-- tr_new_grade_added was applied manually (from backup/) — never part of the
-- official migration chain. It uses type='grade_added' (inconsistent with the
-- rest of the system) and omits the actual score from the message.
-- tr_notify_new_grade (INSERT + UPDATE) already covers everything correctly.

DROP TRIGGER  IF EXISTS tr_new_grade_added  ON public.grades;
DROP FUNCTION IF EXISTS public.on_new_grade_added();


-- ── 2. COMPLAINTS: drop the two redundant UPDATE triggers ─────────────────

-- 2a. tr_handle_complaint_change — fires on INSERT + UPDATE.
--     On UPDATE it produces type='complaint_status', overlapping with both
--     tr_notify_complaint_update (also complaint_status) and
--     tr_notify_complaint_response (complaint_response).
--     Its INSERT branch (notify admins of new complaint) is a separate
--     concern — intentionally NOT replaced here; admin notifications on new
--     complaints can be added as a dedicated migration if needed.
DROP TRIGGER  IF EXISTS tr_handle_complaint_change  ON public.complaints;
DROP FUNCTION IF EXISTS public.handle_complaint_change();

-- 2b. tr_notify_complaint_update — legacy from 20260402280000, fires on UPDATE,
--     produces type='complaint_status', duplicates tr_handle_complaint_change.
DROP TRIGGER  IF EXISTS tr_notify_complaint_update  ON public.complaints;
DROP FUNCTION IF EXISTS public.notify_complaint_update();

-- tr_notify_complaint_response is kept as-is (recreated by 20260808000003).
-- It fires on UPDATE when admin_response changes → type='complaint_response'.


-- ── 3. COMPLAINTS: add narrow status-change-only trigger ──────────────────
-- Replaces the status-change coverage that tr_handle_complaint_change provided,
-- but ONLY fires when status changes AND admin_response did NOT change in the
-- same statement — zero overlap with tr_notify_complaint_response.

CREATE OR REPLACE FUNCTION public.notify_complaint_status_change()
RETURNS trigger AS $$
DECLARE
    v_school_id uuid;
BEGIN
    -- Guard: status must have changed
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
        RETURN NEW;
    END IF;

    -- Guard: admin_response must NOT have changed in this same UPDATE
    -- (if it did, tr_notify_complaint_response already handles it and
    --  includes the status context in its message)
    IF OLD.admin_response IS DISTINCT FROM NEW.admin_response THEN
        RETURN NEW;
    END IF;

    v_school_id := COALESCE(
        NEW.school_id,
        (SELECT school_id FROM public.profiles WHERE id = NEW.parent_id LIMIT 1)
    );

    INSERT INTO public.notifications
           (user_id, school_id, type, title, message, metadata)
    VALUES (
        NEW.parent_id,
        v_school_id,
        'complaint_status',
        CASE
            WHEN NEW.status = 'resolved'                     THEN 'تم حل الشكوى'
            WHEN NEW.status IN ('in_progress', 'processing') THEN 'جاري معالجة الشكوى'
            ELSE 'تحديث في حالة الشكوى'
        END,
        CASE
            WHEN NEW.status = 'pending'     THEN 'شكواك الآن في الانتظار'
            WHEN NEW.status = 'processing'  THEN 'شكواك قيد المعالجة'
            WHEN NEW.status = 'in_progress' THEN 'جاري العمل على شكواك'
            WHEN NEW.status = 'resolved'    THEN 'تم حل شكواك بنجاح'
            ELSE 'تم تغيير حالة شكواك إلى: ' || NEW.status
        END,
        jsonb_build_object(
            'complaint_id', NEW.id,
            'old_status',   OLD.status,
            'new_status',   NEW.status,
            'url',          '/parent/complaints'
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_complaint_status_change ON public.complaints;
CREATE TRIGGER tr_notify_complaint_status_change
    AFTER UPDATE ON public.complaints
    FOR EACH ROW EXECUTE FUNCTION public.notify_complaint_status_change();


-- ── 4. Verify final state (run manually after applying) ───────────────────
/*
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('grades', 'complaints', 'attendance')
ORDER BY event_object_table, trigger_name, event_manipulation;

Expected:
  attendance  | tr_notify_attendance              | INSERT  | notify_attendance_update()
  attendance  | tr_notify_attendance              | UPDATE  | notify_attendance_update()
  complaints  | tr_notify_complaint_response      | UPDATE  | notify_complaint_response()
  complaints  | tr_notify_complaint_status_change | UPDATE  | notify_complaint_status_change()
  grades      | tr_notify_new_grade               | INSERT  | notify_new_grade()
  grades      | tr_notify_new_grade               | UPDATE  | notify_new_grade()
*/

NOTIFY pgrst, 'reload schema';
