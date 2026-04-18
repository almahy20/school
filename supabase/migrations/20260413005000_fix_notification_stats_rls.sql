-- Fix RLS and trigger issues for notification_stats
-- This migration fixes the "new row violates row-level security policy for table notification_stats" error

-- 1. Make the trigger function SECURITY DEFINER to bypass RLS
-- This allows the trigger to update stats for any user regardless of who performs the action
CREATE OR REPLACE FUNCTION public.update_notification_stats()
RETURNS trigger AS $$
BEGIN
  -- On notification INSERT
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notification_stats (user_id, school_id, total_sent, last_notification_at)
    VALUES (NEW.user_id, NEW.school_id, 1, NEW.created_at)
    ON CONFLICT (user_id) DO UPDATE SET
      total_sent = notification_stats.total_sent + 1,
      last_notification_at = NEW.created_at,
      updated_at = NOW();
    
    RETURN NEW;
  END IF;
  
  -- On notification UPDATE (when marked as read)
  IF TG_OP = 'UPDATE' AND NEW.is_read = true AND OLD.is_read = false THEN
    UPDATE public.notification_stats
    SET total_read = total_read + 1,
        last_read_at = NOW(),
        updated_at = NOW()
    WHERE user_id = NEW.user_id;
    
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure RLS policies are correct for notification_stats
-- We keep them for safety, but SECURITY DEFINER trigger will bypass them
DROP POLICY IF EXISTS "Users can view their own notification stats" ON public.notification_stats;
CREATE POLICY "Users can view their own notification stats" ON public.notification_stats
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid() 
        OR public.is_super_admin()
        OR school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
    );

DROP POLICY IF EXISTS "Triggers can insert notification stats" ON public.notification_stats;
CREATE POLICY "Triggers can insert notification stats" ON public.notification_stats
    FOR INSERT TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Triggers can update notification stats" ON public.notification_stats;
CREATE POLICY "Triggers can update notification stats" ON public.notification_stats
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

-- 3. Fix notifications SELECT policy to allow senders to see their sent notifications
-- Since we don't have a sender_id column, we check the metadata
-- This is a temporary fix until a proper sender_id column is added
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid() 
        OR public.is_super_admin()
        OR (metadata->>'sender_id')::uuid = auth.uid()
    );

-- 4. Fix notifications INSERT policy to be more robust
DROP POLICY IF EXISTS "notifications_isolation" ON public.notifications;
CREATE POLICY "notifications_isolation" ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_super_admin() 
        OR school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
        OR user_id = auth.uid()
    );

-- 5. Ensure permissions are granted
GRANT ALL ON public.notification_stats TO authenticated;
GRANT ALL ON public.notifications TO authenticated;

-- 6. Reload schema cache
NOTIFY pgrst, 'reload schema';
