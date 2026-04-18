-- Comprehensive Database Schema Validation and Fixes
-- This migration ensures all required columns, indexes, and constraints exist

-- ==========================================
-- 1. NOTIFICATIONS TABLE - Ensure all columns exist
-- ==========================================

-- Add school_id if missing (for multi-tenancy)
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- Add index on school_id for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_school_id ON public.notifications(school_id);

-- Add index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

-- Add index on is_read for filtering unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- Add index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- ==========================================
-- 2. MESSAGES TABLE - Ensure all columns and indexes
-- ==========================================

-- Ensure school_id exists
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- Ensure student_id exists
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.students(id) ON DELETE SET NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_student_id ON public.messages(student_id);
CREATE INDEX IF NOT EXISTS idx_messages_school_id ON public.messages(school_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);

-- ==========================================
-- 3. PROFILES TABLE - Ensure last_seen exists
-- ==========================================

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add index for last_seen
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON public.profiles(last_seen);

-- Add index on school_id for filtering
CREATE INDEX IF NOT EXISTS idx_profiles_school_id ON public.profiles(school_id);

-- ==========================================
-- 4. NOTIFICATION_STATS - Handle as table or view
-- ==========================================

-- Check if notification_stats is a view
DO $$
DECLARE
    is_view BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_schema = 'public' 
        AND table_name = 'notification_stats'
    ) INTO is_view;
    
    IF is_view THEN
        -- It's a view, drop it first to recreate as table
        DROP VIEW IF EXISTS public.notification_stats CASCADE;
        RAISE NOTICE 'Dropped existing notification_stats view, will recreate as table';
    END IF;
END $$;

-- Now create the table
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

-- Enable RLS (only works on tables)
ALTER TABLE public.notification_stats ENABLE ROW LEVEL SECURITY;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_notification_stats_user_id ON public.notification_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_stats_school_id ON public.notification_stats(school_id);

-- ==========================================
-- 5. RLS POLICIES - Ensure all policies exist
-- ==========================================

-- Notifications policies
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "Service role can manage all notifications" ON public.notifications;
CREATE POLICY "Service role can manage all notifications" ON public.notifications
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_isolation" ON public.notifications;
CREATE POLICY "notifications_isolation" ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_super_admin() 
        OR school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
        OR user_id = auth.uid()
    );

-- Messages policies
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
CREATE POLICY "Users can view their own messages" ON public.messages
    FOR SELECT TO authenticated
    USING (sender_id = auth.uid() OR receiver_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "Service role can manage all messages" ON public.messages;
CREATE POLICY "Service role can manage all messages" ON public.messages
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Notification stats policies (already added in previous migration, but ensure they exist)
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

-- ==========================================
-- 6. GRANT PERMISSIONS
-- ==========================================

GRANT ALL ON public.notifications TO authenticated;
GRANT ALL ON public.messages TO authenticated;
GRANT ALL ON public.notification_stats TO authenticated;

-- ==========================================
-- 7. REALTIME - Enable for notifications
-- ==========================================

DO $$
BEGIN
  -- Enable realtime for notifications table
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Handle gracefully if publication doesn't exist
END $$;

-- Enable realtime for messages table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Handle gracefully
END $$;

-- ==========================================
-- 8. VACUUM AND ANALYZE - Update statistics
-- ==========================================

ANALYZE public.notifications;
ANALYZE public.messages;
ANALYZE public.notification_stats;
ANALYZE public.profiles;

NOTIFY pgrst, 'reload schema';
