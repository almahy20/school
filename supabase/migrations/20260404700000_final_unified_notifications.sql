-- Migration: 20260404700000_final_unified_notifications.sql
-- Goal: Unified notification system for all school events with automatic Web Push

-- 1. Ensure notifications table is ready
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Comprehensive Trigger for Attendance
CREATE OR REPLACE FUNCTION public.notify_attendance_update()
RETURNS trigger AS $$
DECLARE
    v_parent_id uuid;
    v_student_name text;
    v_status_ar text;
BEGIN
    IF (NEW.status IN ('absent', 'late')) THEN
        SELECT name INTO v_student_name FROM public.students WHERE id = NEW.student_id;
        v_status_ar := CASE WHEN NEW.status = 'absent' THEN 'غائب' ELSE 'متأخر' END;
        
        FOR v_parent_id IN (SELECT parent_id FROM public.student_parents WHERE student_id = NEW.student_id)
        LOOP
            INSERT INTO public.notifications (user_id, school_id, type, title, message, metadata)
            VALUES (
                v_parent_id,
                NEW.school_id,
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

DROP TRIGGER IF EXISTS tr_notify_attendance ON public.attendance;
CREATE TRIGGER tr_notify_attendance AFTER INSERT OR UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.notify_attendance_update();

-- 3. Comprehensive Trigger for Grades
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

DROP TRIGGER IF EXISTS tr_notify_new_grade ON public.grades;
CREATE TRIGGER tr_notify_new_grade AFTER INSERT OR UPDATE ON public.grades FOR EACH ROW EXECUTE FUNCTION public.notify_new_grade();

-- 4. Unified Push Function (The heart of notifications)
-- This function will be called whenever a row is inserted into 'notifications'
CREATE OR REPLACE FUNCTION public.trigger_push_on_notification_insert()
RETURNS trigger AS $$
DECLARE
    v_supabase_url TEXT;
    v_supabase_anon_key TEXT;
BEGIN
    v_supabase_url := 'https://mecutwhreywjwstirpka.supabase.co';
    -- This key must be valid for your project. If it fails, check Dashboard > Settings > API
    v_supabase_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lY3V0d2hyZXl3andzdGlycGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzI5MDEsImV4cCI6MjA5MDQ0ODkwMX0.jlWByWUJI1pTeK_JfFzouD1b5NJC02dE1LILA2iNkII';

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

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_auto_push_on_notification ON public.notifications;
CREATE TRIGGER tr_auto_push_on_notification
    AFTER INSERT ON public.notifications
    FOR EACH ROW EXECUTE FUNCTION public.trigger_push_on_notification_insert();

-- 5. Fix RLS for approvals and roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles" ON public.user_roles
    FOR ALL TO authenticated
    USING (
        public.is_super_admin()
        OR school_id = public.get_my_school_id()
    );

NOTIFY pgrst, 'reload schema';
