-- Add last_seen and notification tracking for parents

-- 1. Add last_seen column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Add index for better performance (without WHERE clause since role is in user_roles)
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON public.profiles(last_seen);

-- 3. Create function to update last_seen
CREATE OR REPLACE FUNCTION public.update_last_seen()
RETURNS trigger AS $$
BEGIN
  NEW.last_seen = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger to update last_seen on any profile update
DROP TRIGGER IF EXISTS tr_update_last_seen ON public.profiles;
CREATE TRIGGER tr_update_last_seen
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_last_seen();

-- 5. Add notification_stats tracking (optional enhancement)
-- This tracks how many notifications each user has read/unread
-- Note: Skip if notification_stats already exists as a view
CREATE TABLE IF NOT EXISTS public.notification_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  total_sent INTEGER DEFAULT 0,
  total_read INTEGER DEFAULT 0,
  last_notification_at TIMESTAMP WITH TIME ZONE,
  last_read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 6. Skip index if it's a view (index not needed for views)
-- CREATE INDEX IF NOT EXISTS idx_notification_stats_user ON public.notification_stats(user_id);

-- 7. Function to update notification stats
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
$$ LANGUAGE plpgsql;

-- 8. Create trigger for notification stats
DROP TRIGGER IF EXISTS tr_notification_stats ON public.notifications;
CREATE TRIGGER tr_notification_stats
  AFTER INSERT OR UPDATE OF is_read ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_notification_stats();

-- 9. Grant permissions
GRANT ALL ON public.notification_stats TO authenticated;

-- 10. Enable RLS on notification_stats
ALTER TABLE public.notification_stats ENABLE ROW LEVEL SECURITY;

-- 11. Create RLS policies for notification_stats
DROP POLICY IF EXISTS "Users can view their own notification stats" ON public.notification_stats;
CREATE POLICY "Users can view their own notification stats" ON public.notification_stats
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "Service role can manage notification stats" ON public.notification_stats;
CREATE POLICY "Service role can manage notification stats" ON public.notification_stats
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Triggers can insert notification stats" ON public.notification_stats;
CREATE POLICY "Triggers can insert notification stats" ON public.notification_stats
    FOR INSERT TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Triggers can update notification stats" ON public.notification_stats;
CREATE POLICY "Triggers can update notification stats" ON public.notification_stats
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
