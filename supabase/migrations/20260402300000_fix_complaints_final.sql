-- Migration: 20260402300000_fix_complaints_final
-- Goal: Fix 400 error by adding school_id to complaints and updating triggers

-- 1. Add school_id to complaints if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='complaints' AND column_name='school_id') THEN
        ALTER TABLE public.complaints ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Populate school_id for existing complaints
-- Try to get it from student, then parent's user_roles
UPDATE public.complaints c
SET school_id = s.school_id
FROM public.students s
WHERE c.student_id = s.id
AND c.school_id IS NULL;

UPDATE public.complaints c
SET school_id = ur.school_id
FROM public.user_roles ur
WHERE c.parent_id = ur.user_id
AND c.school_id IS NULL;

-- 3. Update status check constraint
ALTER TABLE public.complaints DROP CONSTRAINT IF EXISTS complaints_status_check;
ALTER TABLE public.complaints ADD CONSTRAINT complaints_status_check 
CHECK (status IN ('pending', 'processing', 'resolved', 'in_progress'));

-- 4. Fix Trigger Function to be more robust
CREATE OR REPLACE FUNCTION public.on_complaint_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_school_id UUID;
BEGIN
    -- Ensure we have a school_id
    v_school_id := COALESCE(NEW.school_id, (SELECT school_id FROM public.user_roles WHERE user_id = NEW.parent_id LIMIT 1));
    
    IF (OLD.status IS DISTINCT FROM NEW.status) AND v_school_id IS NOT NULL THEN
        INSERT INTO public.notifications (
            school_id, 
            user_id, 
            title, 
            message, 
            type, 
            link,
            content
        )
        VALUES (
            v_school_id, 
            NEW.parent_id, 
            'تحديث بخصوص شكواك', 
            'تم تغيير حالة شكواك إلى: ' || 
            CASE 
                WHEN NEW.status = 'in_progress' THEN 'قيد التنفيذ'
                WHEN NEW.status = 'resolved' THEN 'تم الحل'
                ELSE NEW.status
            END,
            'complaint_status', 
            '/parent/complaints',
            'تم تغيير حالة شكواك إلى: ' || NEW.status
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Re-apply trigger
DROP TRIGGER IF EXISTS tr_complaint_status_change ON public.complaints;
CREATE TRIGGER tr_complaint_status_change
    AFTER UPDATE OF status ON public.complaints
    FOR EACH ROW
    EXECUTE FUNCTION public.on_complaint_status_change();

-- 6. Also fix the notify_admin_new_complaint trigger
CREATE OR REPLACE FUNCTION public.notify_admin_new_complaint()
RETURNS TRIGGER AS $$
DECLARE
    v_admin_id uuid;
    v_school_id uuid;
BEGIN
    v_school_id := COALESCE(NEW.school_id, (SELECT school_id FROM public.user_roles WHERE user_id = NEW.parent_id LIMIT 1));
    
    IF v_school_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Find all approved admins for the school
    FOR v_admin_id IN (
        SELECT user_id 
        FROM public.user_roles 
        WHERE school_id = v_school_id 
        AND role = 'admin'
    )
    LOOP
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
            v_admin_id,
            v_school_id,
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
