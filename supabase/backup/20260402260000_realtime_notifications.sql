-- ==========================================
-- Migration: 20260402260000_realtime_notifications
-- Goal: Fix complaints schema and add Notifications system
-- ==========================================

-- 1. FIX COMPLAINTS TABLE
-- Explicitly name the foreign key for 'students' used in AdminComplaintsPage.tsx
ALTER TABLE public.complaints DROP CONSTRAINT IF EXISTS complaints_student_id_fkey;
ALTER TABLE public.complaints ADD CONSTRAINT complaints_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- 2. CREATE NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL, -- 'complaint_status', 'grade_added', 'general'
    link TEXT, -- Optional link to redirect the user
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 3. NOTIFICATION POLICIES
-- Users see their own notifications, Super Admins see everything
CREATE POLICY "notifications_isolation" ON public.notifications 
FOR ALL TO authenticated 
USING (
    (SELECT is_super_admin FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) = true
    OR user_id = auth.uid()
);

-- 4. ENABLE REALTIME
-- Enable realtime for the notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 5. NOTIFICATION AUTO-TRIGGER FUNCTIONS
-- A function to create notifications from other triggers
CREATE OR REPLACE FUNCTION public.create_notification(
    p_school_id UUID,
    p_user_id UUID,
    p_title TEXT,
    p_message TEXT,
    p_type TEXT,
    p_link TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
    INSERT INTO public.notifications (school_id, user_id, title, message, type, link)
    VALUES (p_school_id, p_user_id, p_title, p_message, p_type, p_link);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. COMPLAINTS STATUS CHANGE TRIGGER
CREATE OR REPLACE FUNCTION public.on_complaint_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        PERFORM public.create_notification(
            NEW.school_id,
            NEW.parent_id,
            'تحديث بخصوص شكواك',
            'تم تغيير حالة شكواك إلى: ' || 
            CASE 
                WHEN NEW.status = 'in_progress' THEN 'قيد التنفيذ'
                WHEN NEW.status = 'resolved' THEN 'تم الحل'
                ELSE 'قيد الانتظار'
            END,
            'complaint_status',
            '/parent/complaints'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_complaint_status_change ON public.complaints;
CREATE TRIGGER tr_complaint_status_change
    AFTER UPDATE OF status ON public.complaints
    FOR EACH ROW
    EXECUTE FUNCTION public.on_complaint_status_change();

-- 7. NEW GRADE TRIGGER
CREATE OR REPLACE FUNCTION public.on_new_grade_added()
RETURNS TRIGGER AS $$
DECLARE
    v_parent_id UUID;
    v_student_name TEXT;
BEGIN
    -- Find the parent(s) of the student
    SELECT name INTO v_student_name FROM public.students WHERE id = NEW.student_id;
    
    FOR v_parent_id IN 
        SELECT parent_id FROM public.student_parents WHERE student_id = NEW.student_id
    LOOP
        PERFORM public.create_notification(
            NEW.school_id,
            v_parent_id,
            'درجة جديدة لطالبك',
            'تم رصد درجة جديدة للطالب ' || v_student_name || ' في مادة الامتحان بتاريخ ' || NEW.date,
            'grade_added',
            '/parent/children/' || NEW.student_id
        );
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_new_grade_added ON public.grades;
CREATE TRIGGER tr_new_grade_added
    AFTER INSERT ON public.grades
    FOR EACH ROW
    EXECUTE FUNCTION public.on_new_grade_added();

-- Reload
NOTIFY pgrst, 'reload schema';
