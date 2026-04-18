-- Migration: 20260405000000_fees_notification_trigger.sql
-- Goal: Automatically notify parents when a new fee is assigned or a payment is received

CREATE OR REPLACE FUNCTION public.notify_fee_event()
RETURNS trigger AS $$
DECLARE
    v_parent_id uuid;
    v_student_name text;
    v_month_name text;
    v_months_ar text[] := ARRAY['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    v_amount_diff numeric;
    v_remains numeric;
BEGIN
    SELECT name INTO v_student_name FROM public.students WHERE id = NEW.student_id;
    
    -- Ensure month is within bounds for array access (1-12)
    IF NEW.month >= 1 AND NEW.month <= 12 THEN
        v_month_name := v_months_ar[NEW.month];
    ELSE
        v_month_name := 'غير محدد';
    END IF;

    -- CASE 1: New Fee Created
    IF (TG_OP = 'INSERT') THEN
        FOR v_parent_id IN (SELECT parent_id FROM public.student_parents WHERE student_id = NEW.student_id)
        LOOP
            INSERT INTO public.notifications (user_id, school_id, type, title, message, metadata)
            VALUES (
                v_parent_id,
                NEW.school_id,
                'new_fee',
                'مطالبة مالية جديدة',
                'تم إصدار مطالبة مالية جديدة للطالب ' || v_student_name || ' لشهر ' || v_month_name || ' ' || NEW.year || ' بمبلغ ' || NEW.amount_due || ' ج.م',
                jsonb_build_object('student_id', NEW.student_id, 'month', NEW.month, 'year', NEW.year, 'url', '/parent/children/' || NEW.student_id)
            );
        END LOOP;
    
    -- CASE 2: Payment Received (Update)
    ELSIF (TG_OP = 'UPDATE' AND NEW.amount_paid > OLD.amount_paid) THEN
        v_amount_diff := NEW.amount_paid - OLD.amount_paid;
        v_remains := NEW.amount_due - NEW.amount_paid;
        
        FOR v_parent_id IN (SELECT parent_id FROM public.student_parents WHERE student_id = NEW.student_id)
        LOOP
            INSERT INTO public.notifications (user_id, school_id, type, title, message, metadata)
            VALUES (
                v_parent_id,
                NEW.school_id,
                'fee_payment',
                'سند قبض مالي',
                'تم استلام دفعة بمبلغ ' || v_amount_diff || ' ج.م للطالب ' || v_student_name || '. المتبقي: ' || v_remains || ' ج.م',
                jsonb_build_object('student_id', NEW.student_id, 'url', '/parent/children/' || NEW.student_id)
            );
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_fee_event ON public.fees;
CREATE TRIGGER tr_notify_fee_event
    AFTER INSERT OR UPDATE ON public.fees
    FOR EACH ROW EXECUTE FUNCTION public.notify_fee_event();

NOTIFY pgrst, 'reload schema';
