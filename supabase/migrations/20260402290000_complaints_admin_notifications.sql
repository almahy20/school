-- Migration: 20260402290000_complaints_admin_notifications
-- Goal: Notify admins of new complaints and unify notifications schema

-- 1. Ensure notifications table has all necessary columns
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='content') THEN
        ALTER TABLE public.notifications ADD COLUMN content TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='link') THEN
        ALTER TABLE public.notifications ADD COLUMN link TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='school_id') THEN
        ALTER TABLE public.notifications ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Create function to notify school admins of a new complaint
CREATE OR REPLACE FUNCTION public.notify_admin_new_complaint()
RETURNS TRIGGER AS $$
DECLARE
    v_admin_id uuid;
BEGIN
    -- Find all approved admins for the school
    FOR v_admin_id IN (
        SELECT user_id 
        FROM public.user_roles 
        WHERE school_id = NEW.school_id 
        AND role = 'admin'
    )
    LOOP
        INSERT INTO public.notifications (
            user_id,
            school_id,
            title,
            content,
            message, -- for backward compatibility if some triggers still use it
            type,
            link
        )
        VALUES (
            v_admin_id,
            NEW.school_id,
            'شكوى جديدة من ولي أمر',
            'تم استلام شكوى جديدة بخصوص: ' || LEFT(NEW.content, 50),
            'تم استلام شكوى جديدة بخصوص: ' || LEFT(NEW.content, 50),
            'complaint_new',
            '/manage-complaints'
        );
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create trigger
DROP TRIGGER IF EXISTS tr_notify_admin_new_complaint ON public.complaints;
CREATE TRIGGER tr_notify_admin_new_complaint
    AFTER INSERT ON public.complaints
    FOR EACH ROW EXECUTE FUNCTION public.notify_admin_new_complaint();

-- 4. Correct the previous status update trigger to also fill 'message' column for compatibility
CREATE OR REPLACE FUNCTION public.notify_complaint_update()
RETURNS TRIGGER AS $$
DECLARE
    v_title TEXT;
    v_content TEXT;
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) OR (OLD.admin_response IS DISTINCT FROM NEW.admin_response) THEN
        v_title := CASE 
                WHEN NEW.status = 'resolved' THEN 'تم حل الشكوى'
                WHEN NEW.status = 'in_progress' OR NEW.status = 'processing' THEN 'جاري معالجة الشكوى'
                ELSE 'تحديث في حالة الشكوى'
            END;
        v_content := CASE 
                WHEN NEW.admin_response IS NOT NULL THEN 'تم الرد على شكواك: ' || LEFT(NEW.admin_response, 50)
                ELSE 'تم تغيير حالة شكواك إلى: ' || NEW.status
            END;

        INSERT INTO public.notifications (
            user_id,
            school_id,
            title,
            content,
            message,
            type,
            link
        )
        VALUES (
            NEW.parent_id,
            NEW.school_id,
            v_title,
            v_content,
            v_content,
            'complaint_status', -- Changed to match schema enum suggestions
            '/parent/complaints'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
