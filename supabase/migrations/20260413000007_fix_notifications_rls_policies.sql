-- Fix RLS policies for notifications table - Allow teachers to insert notifications

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "notifications_isolation" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role can manage all notifications" ON public.notifications;

-- 1. Allow users to VIEW their own notifications (or super admin)
CREATE POLICY "Users can view their own notifications" ON public.notifications
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid() 
        OR public.is_super_admin()
    );

-- 2. Allow authenticated users (including teachers) to INSERT notifications
-- This is needed for teacher-to-parent messaging
CREATE POLICY "Users can insert notifications" ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK (
        -- Must be authenticated
        auth.uid() IS NOT NULL
        -- school_id must match user's school (or super admin)
        AND (
            public.is_super_admin()
            OR school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
        )
    );

-- 3. Allow users to UPDATE their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications" ON public.notifications
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid() OR public.is_super_admin())
    WITH CHECK (user_id = auth.uid() OR public.is_super_admin());

-- 4. Allow users to DELETE their own notifications
CREATE POLICY "Users can delete their own notifications" ON public.notifications
    FOR DELETE TO authenticated
    USING (user_id = auth.uid() OR public.is_super_admin());

-- 5. Service role has full access
CREATE POLICY "Service role can manage all notifications" ON public.notifications
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
