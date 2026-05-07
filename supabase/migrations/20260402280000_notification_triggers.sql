-- 20260402280000_notification_triggers.sql

-- 1. Ensure notifications table exists (defensive)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'complaint_status', 'new_grade', 'alert'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Trigger for Complaint Status Update
CREATE OR REPLACE FUNCTION public.notify_complaint_update()
RETURNS trigger AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.notifications (user_id, type, title, message, metadata)
        VALUES (
            NEW.user_id,
            'complaint_status',
            'تحديث في حالة الشكوى',
            CASE 
                WHEN NEW.status = 'in_progress' THEN 'جاري العمل على شكواك رقم ' || NEW.id
                WHEN NEW.status = 'resolved' THEN 'تم حل شكواك بنجاح. شكراً لك.'
                ELSE 'تغيرت حالة شكواك إلى: ' || NEW.status
            END,
            jsonb_build_object('complaint_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_complaint_update ON public.complaints;
CREATE TRIGGER tr_notify_complaint_update
    AFTER UPDATE ON public.complaints
    FOR EACH ROW EXECUTE FUNCTION public.notify_complaint_update();

-- 3. Trigger for New Grade
CREATE OR REPLACE FUNCTION public.notify_new_grade()
RETURNS trigger AS $$
DECLARE
    v_parent_id uuid;
BEGIN
    -- Notify all parents of the student
    FOR v_parent_id IN (SELECT parent_id FROM public.student_parents WHERE student_id = NEW.student_id)
    LOOP
        INSERT INTO public.notifications (user_id, type, title, message, metadata)
        VALUES (
            v_parent_id,
            'new_grade',
            'درجة جديدة للطالب',
            'تم إضافة درجة جديدة في مادة ' || NEW.subject,
            jsonb_build_object('student_id', NEW.student_id, 'subject', NEW.subject, 'grade_id', NEW.id)
        );
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_new_grade ON public.grades;
CREATE TRIGGER tr_notify_new_grade
    AFTER INSERT ON public.grades
    FOR EACH ROW EXECUTE FUNCTION public.notify_new_grade();

-- 4. Ensure Realtime is enabled for notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Handle gracefully if publication doesn't exist
END $$;

NOTIFY pgrst, 'reload schema';
