-- Migration: 20260417000000_notify_admin_new_parent_signup
-- Goal: Notify school admins when a new parent registers and is pending approval

-- Create function to notify admins of new pending parent
CREATE OR REPLACE FUNCTION public.notify_admin_new_parent_signup()
RETURNS TRIGGER AS $$
DECLARE
    v_admin_id uuid;
    v_school_id uuid;
    v_parent_name text;
    v_parent_phone text;
BEGIN
    -- Get school_id and parent info from the newly created role
    v_school_id := NEW.school_id;
    
    -- If no school_id, we can't notify anyone
    IF v_school_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Get parent name and phone from profiles
    SELECT full_name, phone INTO v_parent_name, v_parent_phone
    FROM public.profiles
    WHERE id = NEW.user_id;
    
    -- Only notify if the user is pending approval
    IF NEW.approval_status != 'pending' THEN
        RETURN NEW;
    END IF;
    
    -- Find all approved admins for the school and notify them
    FOR v_admin_id IN (
        SELECT user_id 
        FROM public.user_roles 
        WHERE school_id = v_school_id 
        AND role = 'admin'
        AND approval_status = 'approved'
    )
    LOOP
        INSERT INTO public.notifications (
            user_id,
            school_id,
            title,
            content,
            type,
            link
        )
        VALUES (
            v_admin_id,
            v_school_id,
            'طلب انضمام ولي أمر جديد',
            'قام ' || COALESCE(v_parent_name, 'ولي أمر') || ' بتسجيل حساب جديد ويرتبط انتظار موافقتك. رقم الهاتف: ' || COALESCE(v_parent_phone, 'غير محدد'),
            'parent_approval_pending',
            '/parents'
        );
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on user_roles table
DROP TRIGGER IF EXISTS tr_notify_admin_new_parent_signup ON public.user_roles;
CREATE TRIGGER tr_notify_admin_new_parent_signup
    AFTER INSERT ON public.user_roles
    FOR EACH ROW
    WHEN (NEW.role = 'parent' AND NEW.approval_status = 'pending')
    EXECUTE FUNCTION public.notify_admin_new_parent_signup();

-- Also notify when teacher registers
CREATE OR REPLACE FUNCTION public.notify_admin_new_teacher_signup()
RETURNS TRIGGER AS $$
DECLARE
    v_admin_id uuid;
    v_school_id uuid;
    v_teacher_name text;
    v_teacher_phone text;
BEGIN
    v_school_id := NEW.school_id;
    
    IF v_school_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    SELECT full_name, phone INTO v_teacher_name, v_teacher_phone
    FROM public.profiles
    WHERE id = NEW.user_id;
    
    IF NEW.approval_status != 'pending' THEN
        RETURN NEW;
    END IF;
    
    FOR v_admin_id IN (
        SELECT user_id 
        FROM public.user_roles 
        WHERE school_id = v_school_id 
        AND role = 'admin'
        AND approval_status = 'approved'
    )
    LOOP
        INSERT INTO public.notifications (
            user_id,
            school_id,
            title,
            content,
            type,
            link
        )
        VALUES (
            v_admin_id,
            v_school_id,
            'طلب انضمام معلم جديد',
            'قام ' || COALESCE(v_teacher_name, 'معلم') || ' بتسجيل حساب جديد ويرتبط انتظار موافقتك. رقم الهاتف: ' || COALESCE(v_teacher_phone, 'غير محدد'),
            'teacher_approval_pending',
            '/teachers'
        );
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_admin_new_teacher_signup ON public.user_roles;
CREATE TRIGGER tr_notify_admin_new_teacher_signup
    AFTER INSERT ON public.user_roles
    FOR EACH ROW
    WHEN (NEW.role = 'teacher' AND NEW.approval_status = 'pending')
    EXECUTE FUNCTION public.notify_admin_new_teacher_signup();
