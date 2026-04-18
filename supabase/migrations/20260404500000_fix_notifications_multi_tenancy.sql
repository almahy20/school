-- Migration: 20260404500000_fix_notifications_multi_tenancy.sql
-- Goal: Fix triggers to include school_id in notifications and ensure data isolation

-- 1. Ensure notifications table has school_id
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- 2. Update notify_new_grade trigger function to include school_id
CREATE OR REPLACE FUNCTION public.notify_new_grade()
RETURNS trigger AS $$
DECLARE
    v_parent_id uuid;
BEGIN
    -- Notify all parents of the student
    FOR v_parent_id IN (SELECT parent_id FROM public.student_parents WHERE student_id = NEW.student_id)
    LOOP
        INSERT INTO public.notifications (user_id, school_id, type, title, message, metadata)
        VALUES (
            v_parent_id,
            NEW.school_id, -- Use school_id from the grades record
            'new_grade',
            'درجة جديدة للطالب',
            'تم إضافة درجة جديدة في مادة ' || NEW.subject || ': ' || NEW.score,
            jsonb_build_object('student_id', NEW.student_id, 'subject', NEW.subject, 'grade_id', NEW.id)
        );
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update notify_complaint_update trigger function to include school_id
CREATE OR REPLACE FUNCTION public.notify_complaint_update()
RETURNS trigger AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.notifications (user_id, school_id, type, title, message, metadata)
        VALUES (
            NEW.parent_id, -- Note: column name might be parent_id or user_id depending on migration version
            NEW.school_id,
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

-- 4. Update Isolation Policy for notifications
-- FIX: Drop existing policy first and use direct query instead of get_my_school_id()
DROP POLICY IF EXISTS "Isolation policy" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_isolation" ON public.notifications;

CREATE POLICY "notifications_isolation" ON public.notifications
    FOR ALL TO authenticated
    USING (
        public.is_super_admin() 
        OR school_id = (
            SELECT school_id FROM public.profiles 
            WHERE id = auth.uid() 
            LIMIT 1
        )
        OR user_id = auth.uid()
    );

NOTIFY pgrst, 'reload schema';
