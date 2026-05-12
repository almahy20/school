-- Migration: 20260404400000_fix_notifications_and_edge_auth.sql
-- Goal: Fix notifications table schema and address Edge Function auth issues

-- 1. Fix notifications table schema (ensure metadata column exists)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- If table exists but metadata is missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE public.notifications ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 2. Ensure RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role can manage all notifications" ON public.notifications;
CREATE POLICY "Service role can manage all notifications" ON public.notifications
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 3. Fix Edge Function trigger (from previous task) - Use Service Role if possible or correct Anon Key
-- We'll recreate the grade notification trigger to be more robust
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
            'تم إضافة درجة جديدة في مادة ' || NEW.subject || ': ' || NEW.score,
            jsonb_build_object('student_id', NEW.student_id, 'subject', NEW.subject, 'grade_id', NEW.id)
        );
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_new_grade ON public.grades;
CREATE TRIGGER tr_notify_new_grade
    AFTER INSERT OR UPDATE ON public.grades
    FOR EACH ROW EXECUTE FUNCTION public.notify_new_grade();

NOTIFY pgrst, 'reload schema';
