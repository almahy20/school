-- Migration: 20260404800000_final_fix_all_notifications.sql
-- Goal: Final fixes for the notification system, ensuring all events trigger push notifications

-- 0. Enable required extensions
-- FIX: Use pg_net instead of net, or skip if not available
DO $$
BEGIN
    -- Try to create the extension
    BEGIN
        CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
    EXCEPTION WHEN OTHERS THEN
        -- If pg_net is not available, log a warning
        RAISE NOTICE 'pg_net extension not available, push notifications will not work';
    END;
END $$;

-- 1. Ensure columns exist for triggers
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.fees ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- 2. Improved Trigger for Attendance
CREATE OR REPLACE FUNCTION public.notify_attendance_update()
RETURNS trigger AS $$
DECLARE
    v_parent_id uuid;
    v_student_name text;
    v_status_ar text;
    v_school_id uuid;
BEGIN
    v_school_id := COALESCE(NEW.school_id, (SELECT school_id FROM public.students WHERE id = NEW.student_id LIMIT 1));
    
    IF (NEW.status IN ('absent', 'late')) THEN
        SELECT name INTO v_student_name FROM public.students WHERE id = NEW.student_id;
        v_status_ar := CASE WHEN NEW.status = 'absent' THEN 'غائب' ELSE 'متأخر' END;
        
        FOR v_parent_id IN (SELECT parent_id FROM public.student_parents WHERE student_id = NEW.student_id)
        LOOP
            INSERT INTO public.notifications (user_id, school_id, type, title, message, metadata)
            VALUES (
                v_parent_id,
                v_school_id,
                'attendance_alert',
                'تنبيه حضور وانضباط',
                'نحيطكم علماً بأن الطالب ' || v_student_name || ' مسجل كـ ' || v_status_ar || ' اليوم ' || NEW.date,
                jsonb_build_object('student_id', NEW.student_id, 'date', NEW.date, 'status', NEW.status, 'url', '/parent/dashboard')
            );
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Improved Trigger for Grades
CREATE OR REPLACE FUNCTION public.notify_new_grade()
RETURNS trigger AS $$
DECLARE
    v_parent_id uuid;
    v_student_name text;
    v_school_id uuid;
BEGIN
    v_school_id := COALESCE(NEW.school_id, (SELECT school_id FROM public.students WHERE id = NEW.student_id LIMIT 1));
    SELECT name INTO v_student_name FROM public.students WHERE id = NEW.student_id;

    FOR v_parent_id IN (SELECT parent_id FROM public.student_parents WHERE student_id = NEW.student_id)
    LOOP
        INSERT INTO public.notifications (user_id, school_id, type, title, message, metadata)
        VALUES (
            v_parent_id,
            v_school_id,
            'new_grade',
            'رصد درجة جديدة',
            'تم رصد درجة الطالب ' || v_student_name || ' في مادة ' || NEW.subject || ': ' || NEW.score,
            jsonb_build_object('student_id', NEW.student_id, 'subject', NEW.subject, 'url', '/parent/children/' || NEW.student_id)
        );
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger for Complaint Admin Response
CREATE OR REPLACE FUNCTION public.notify_complaint_response()
RETURNS trigger AS $$
DECLARE
    v_school_id uuid;
BEGIN
    v_school_id := COALESCE(NEW.school_id, (SELECT school_id FROM public.profiles WHERE id = NEW.parent_id LIMIT 1));

    IF (OLD.admin_response IS NULL AND NEW.admin_response IS NOT NULL) OR (OLD.admin_response IS DISTINCT FROM NEW.admin_response) THEN
        INSERT INTO public.notifications (user_id, school_id, type, title, message, metadata)
        VALUES (
            NEW.parent_id,
            v_school_id,
            'complaint_response',
            'رد على شكواك',
            'قامت إدارة المدرسة بالرد على شكواك رقم ' || NEW.id,
            jsonb_build_object('complaint_id', NEW.id, 'url', '/parent/complaints')
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_complaint_response ON public.complaints;
CREATE TRIGGER tr_notify_complaint_response 
    AFTER UPDATE ON public.complaints 
    FOR EACH ROW EXECUTE FUNCTION public.notify_complaint_response();

-- 5. Trigger for New Fees
CREATE OR REPLACE FUNCTION public.notify_new_fee()
RETURNS trigger AS $$
DECLARE
    v_parent_id uuid;
    v_student_name text;
    v_school_id uuid;
BEGIN
    v_school_id := COALESCE(NEW.school_id, (SELECT school_id FROM public.students WHERE id = NEW.student_id LIMIT 1));
    SELECT name INTO v_student_name FROM public.students WHERE id = NEW.student_id;

    FOR v_parent_id IN (SELECT parent_id FROM public.student_parents WHERE student_id = NEW.student_id)
    LOOP
        INSERT INTO public.notifications (user_id, school_id, type, title, message, metadata)
        VALUES (
            v_parent_id,
            v_school_id,
            'new_fee',
            'إشعار رسوم دراسية',
            'تم إصدار رسوم جديدة للطالب ' || v_student_name || ' لشهر ' || NEW.month || ' بقيمة ' || NEW.amount_due,
            jsonb_build_object('student_id', NEW.student_id, 'fee_id', NEW.id, 'url', '/parent/dashboard')
        );
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_new_fee ON public.fees;
CREATE TRIGGER tr_notify_new_fee 
    AFTER INSERT ON public.fees 
    FOR EACH ROW EXECUTE FUNCTION public.notify_new_fee();

-- 6. Unified Push Function (The heart of notifications)
-- FIX: Use pg_net with error handling
CREATE OR REPLACE FUNCTION public.trigger_push_on_notification_insert()
RETURNS trigger AS $$
DECLARE
    v_supabase_url TEXT;
    v_supabase_anon_key TEXT;
BEGIN
    v_supabase_url := 'https://mecutwhreywjwstirpka.supabase.co';
    -- This key must be valid for your project.
    v_supabase_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lY3V0d2hyZXl3andzdGlycGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzI5MDEsImV4cCI6MjA5MDQ0ODkwMX0.jlWByWUJI1pTeK_JfFzouD1b5NJC02dE1LILA2iNkII';

    -- Try to send push notification, but don't fail if pg_net is not available
    BEGIN
        PERFORM net.http_post(
            url := v_supabase_url || '/functions/v1/send-push-notification',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || v_supabase_anon_key
            ),
            body := jsonb_build_object(
                'user_id', NEW.user_id,
                'title', NEW.title,
                'body', NEW.message,
                'url', COALESCE(NEW.metadata->>'url', '/')
            )
        );
    EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the notification insert
        RAISE NOTICE 'Failed to send push notification: %', SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_auto_push_on_notification ON public.notifications;
CREATE TRIGGER tr_auto_push_on_notification
    AFTER INSERT ON public.notifications
    FOR EACH ROW EXECUTE FUNCTION public.trigger_push_on_notification_insert();

NOTIFY pgrst, 'reload schema';
