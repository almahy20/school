-- 20260402310000_ultimate_complaints_cleanup.sql

-- 1. إسقاط المشغلات القديمة لمنع التعارض السابقة (Drop all old triggers)
DROP TRIGGER IF EXISTS tr_notify_complaint_update ON public.complaints;
DROP TRIGGER IF EXISTS tr_complaint_status_change ON public.complaints;
DROP TRIGGER IF EXISTS tr_notify_admin_new_complaint ON public.complaints;

-- 2. إسقاط الدوال القديمة (Drop all old functions)
DROP FUNCTION IF EXISTS public.notify_complaint_update();
DROP FUNCTION IF EXISTS public.on_complaint_status_change();
DROP FUNCTION IF EXISTS public.notify_admin_new_complaint();

-- 3. دالة جديدة موحدة وصلبة (New unified and robust function)
CREATE OR REPLACE FUNCTION public.handle_complaint_change()
RETURNS TRIGGER AS $$
DECLARE
    v_admin_id UUID;
    v_title TEXT;
    v_content TEXT;
    v_school_id UUID;
BEGIN
    -- Determine school_id (fallback logically if somehow missing, but it shouldn't be)
    v_school_id := COALESCE(NEW.school_id, OLD.school_id);

    IF v_school_id IS NULL THEN
        -- Fallback to finding it from student if needed, but normally it's set
        SELECT school_id INTO v_school_id FROM public.students WHERE id = COALESCE(NEW.student_id, OLD.student_id) LIMIT 1;
    END IF;

    -- If it's an INSERT (New Complaint)
    IF TG_OP = 'INSERT' THEN
        -- Notify all admins in the school
        FOR v_admin_id IN (
            SELECT user_id 
            FROM public.user_roles 
            WHERE school_id = v_school_id AND role = 'admin'
        )
        LOOP
            INSERT INTO public.notifications (
                user_id,
                school_id,
                title,
                message,
                type,
                link
            )
            VALUES (
                v_admin_id,
                v_school_id,
                'شكوى جديدة من ولي أمر',
                'تم استلام شكوى جديدة بخصوص: ' || COALESCE(LEFT(NEW.content, 50), 'موضوع غير محدد'),
                'complaint_new',
                '/manage-complaints'
            );
        END LOOP;
    
    -- If it's an UPDATE (Status/Response change)
    ELSIF TG_OP = 'UPDATE' THEN
        IF (OLD.status IS DISTINCT FROM NEW.status) OR (OLD.admin_response IS DISTINCT FROM NEW.admin_response) THEN
            
            v_title := CASE 
                    WHEN NEW.status = 'resolved' THEN 'تم حل الشكوى'
                    WHEN NEW.status IN ('in_progress', 'processing') THEN 'جاري معالجة الشكوى'
                    ELSE 'تحديث في حالة الشكوى'
                END;
                
            v_content := CASE 
                    WHEN NEW.admin_response IS DISTINCT FROM OLD.admin_response AND NEW.admin_response IS NOT NULL 
                        THEN 'تم الرد على شكواك: ' || LEFT(NEW.admin_response, 50)
                    ELSE 'تم تغيير حالة شكواك إلى: ' || 
                        CASE NEW.status
                            WHEN 'pending' THEN 'االانتظار'
                            WHEN 'processing' THEN 'قيد المعالجة'
                            WHEN 'in_progress' THEN 'قيد التنفيذ'
                            WHEN 'resolved' THEN 'محلولة'
                            ELSE NEW.status
                        END
                END;

            -- We notify the parent
            IF NEW.parent_id IS NOT NULL THEN
                INSERT INTO public.notifications (
                    user_id,
                    school_id,
                    title,
                    message,
                    type,
                    link
                )
                VALUES (
                    NEW.parent_id,
                    v_school_id,
                    v_title,
                    v_content,
                    'complaint_status',
                    '/parent/complaints'
                );
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. ربط المشغل الجديد بالجدول (Attach new unified trigger)
CREATE TRIGGER tr_handle_complaint_change
    AFTER INSERT OR UPDATE ON public.complaints
    FOR EACH ROW EXECUTE FUNCTION public.handle_complaint_change();

-- 5. تحديث الـ Schema Cache
NOTIFY pgrst, 'reload schema';
