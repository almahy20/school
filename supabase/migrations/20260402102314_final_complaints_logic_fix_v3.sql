-- ==========================================
-- Migration: 20260402102314_final_complaints_logic_fix_v3
-- Goal: Fix status constraints, notification triggers, and RLS for complaints
-- ==========================================

-- 1. Update checkout constraint to include 'in_progress' and be consistent
ALTER TABLE public.complaints DROP CONSTRAINT IF EXISTS complaints_status_check;
ALTER TABLE public.complaints ADD CONSTRAINT complaints_status_check 
    CHECK (status IN ('pending', 'processing', 'resolved', 'in_progress'));

-- 2. Fix the notification trigger function to use the correct notifications schema
CREATE OR REPLACE FUNCTION public.notify_complaint_update()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) OR (OLD.admin_response IS DISTINCT FROM NEW.admin_response) THEN
        INSERT INTO public.notifications (
            user_id,
            school_id,
            title,
            message,
            type,
            metadata
        )
        VALUES (
            NEW.parent_id,
            NEW.school_id,
            CASE 
                WHEN NEW.status = 'resolved' THEN 'تم حل الشكوى'
                WHEN NEW.status = 'in_progress' OR NEW.status = 'processing' THEN 'جاري معالجة الشكوى'
                ELSE 'تحديث في حالة الشكوى'
            END,
            CASE 
                WHEN NEW.admin_response IS NOT NULL THEN 'تم الرد على شكواك: ' || LEFT(NEW.admin_response, 50)
                ELSE 'تم تغيير حالة شكواك إلى: ' || NEW.status
            END,
            'complaint',
            jsonb_build_object('url', '/parent/complaints', 'complaint_id', NEW.id)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ensure RLS allows parents to see their own complaints
DROP POLICY IF EXISTS "complaints_parent_access" ON public.complaints;
CREATE POLICY "complaints_parent_access" ON public.complaints
    FOR ALL TO authenticated
    USING ( parent_id = auth.uid() )
    WITH CHECK ( parent_id = auth.uid() );

-- 4. Enable Realtime for complaints safely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'complaints'
    ) THEN
        ALTER publication supabase_realtime ADD TABLE public.complaints;
    END IF;
END $$;

-- Reload schema
NOTIFY pgrst, 'reload schema';
