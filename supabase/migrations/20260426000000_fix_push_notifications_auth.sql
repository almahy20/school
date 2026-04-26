-- 20260426000000_fix_push_notifications_auth.sql
-- Goal: Fix 401 errors in send-push-notification Edge Function
-- This migration:
-- 1. Creates push_subscriptions table if not exists
-- 2. Updates webhook to use service_role key from vault
-- 3. Adds proper RLS policies

-- ==========================================
-- 1. Create push_subscriptions table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  endpoint TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(endpoint)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON public.push_subscriptions(endpoint);

-- ==========================================
-- 2. Enable Row Level Security (RLS)
-- ==========================================
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 3. Create RLS Policies
-- ==========================================

-- Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own subscriptions
CREATE POLICY "Users can insert own subscriptions"
  ON public.push_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own subscriptions
CREATE POLICY "Users can update own subscriptions"
  ON public.push_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own subscriptions
CREATE POLICY "Users can delete own subscriptions"
  ON public.push_subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can access all subscriptions (for Edge Functions)
-- This is implicit when using service_role key (bypasses RLS)

-- ==========================================
-- 4. Create function to cleanup expired subscriptions
-- ==========================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_subscriptions()
RETURNS void AS $$
BEGIN
  -- This function can be called periodically to clean up old subscriptions
  -- Actual cleanup happens in the Edge Function when 410/404 errors occur
  DELETE FROM public.push_subscriptions
  WHERE updated_at < NOW() - INTERVAL '90 days';
  
  RAISE NOTICE 'Cleaned up expired subscriptions';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 5. Store service_role key in Edge Function Secrets
-- ==========================================
-- IMPORTANT: Since vault extension is not available on all Supabase instances,
-- we'll use Edge Function Secrets instead (also secure)
--
-- Setup Instructions:
-- 1. Go to Supabase Dashboard > Edge Functions > send-push-notification > Secrets
-- 2. Add these secrets:
--    - SUPABASE_URL = https://mecutwhreywjwstirpka.supabase.co
--    - SUPABASE_SERVICE_ROLE_KEY = your_service_role_key_here
--    - VAPID_PUBLIC_KEY = your_vapid_public_key
--    - VAPID_PRIVATE_KEY = your_vapid_private_key
--
-- NOTE: DO NOT store keys in this migration file!
-- Use Edge Function Secrets dashboard instead.

-- ==========================================
-- 6. Update webhook trigger to use service_role from Edge Function Secrets
-- ==========================================
CREATE OR REPLACE FUNCTION public.trigger_push_on_notification_insert()
RETURNS trigger AS $$
DECLARE
    v_supabase_url TEXT;
    v_service_role_key TEXT;
    v_request_id BIGINT;
BEGIN
    -- Get project URL (set in your environment or use fallback)
    v_supabase_url := current_setting('app.settings.supabase_url', true);
    IF v_supabase_url IS NULL THEN
      -- Fallback: use your actual project URL
      v_supabase_url := 'https://mecutwhreywjwstirpka.supabase.co';
    END IF;

    -- IMPORTANT: Since vault is not available, we need to set the service_role key
    -- directly in the webhook or use a custom GUC (Grand Unified Configuration)
    --
    -- Option 1: Set via SQL (less secure, but works)
    -- Run this ONCE in SQL Editor to set the key as a custom config:
    -- ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_KEY_HERE';
    --
    -- Option 2: Use the key directly here (not recommended for production)
    -- For now, we'll use a placeholder - YOU MUST REPLACE THIS:
    v_service_role_key := current_setting('app.settings.service_role_key', true);
    
    IF v_service_role_key IS NULL OR v_service_role_key = '' THEN
      -- FALLBACK ONLY - Replace with your actual service_role key
      -- Get it from: Dashboard > Settings > API > service_role (secret)
      v_service_role_key := 'REPLACE_WITH_YOUR_ACTUAL_SERVICE_ROLE_KEY';
      
      -- Safety check - don't use placeholder in production!
      IF v_service_role_key = 'REPLACE_WITH_YOUR_ACTUAL_SERVICE_ROLE_KEY' THEN
        RAISE WARNING 'Service role key not configured! Please run: ALTER DATABASE postgres SET app.settings.service_role_key = ''YOUR_KEY_HERE'';';
        -- Don't fail, just skip push notification
        RETURN NEW;
      END IF;
    END IF;

    -- Send push notification asynchronously
    BEGIN
      SELECT net.http_post(
        url := v_supabase_url || '/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key,
          'apikey', v_service_role_key
        ),
        body := jsonb_build_object(
          'user_id', NEW.user_id,
          'title', NEW.title,
          'body', NEW.message,
          'url', COALESCE(NEW.metadata->>'url', '/')
        )
      ) INTO v_request_id;
      
      RAISE NOTICE 'Push notification queued for user % (request_id: %)', NEW.user_id, v_request_id;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the notification insert
      RAISE WARNING 'Failed to queue push notification: %', SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 7. Grant necessary permissions
-- ==========================================
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT ALL ON public.push_subscriptions TO authenticated, service_role;

-- ==========================================
-- 8. Add helpful comments
-- ==========================================
COMMENT ON TABLE public.push_subscriptions IS 'Stores web push notification subscriptions for users';
COMMENT ON COLUMN public.push_subscriptions.subscription IS 'Full push subscription object from PushManager.subscribe()';
COMMENT ON COLUMN public.push_subscriptions.endpoint IS 'Push service endpoint URL (used for unique constraint)';

-- ==========================================
-- IMPORTANT SETUP INSTRUCTIONS:
-- ==========================================
-- 1. Set your service_role key as a database config:
--    Run this ONCE in SQL Editor (replace with your actual key):
--    ALTER DATABASE postgres SET app.settings.service_role_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
--
--    Get your key from: Dashboard > Settings > API > service_role (secret)
--
-- 2. Set Edge Function secrets:
--    Go to: Edge Functions > send-push-notification > Secrets
--    Add: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
--
-- 3. Deploy the updated Edge Function:
--    supabase functions deploy send-push-notification
--
-- 4. Test the function:
--    See PUSH_NOTIFICATION_FIX_GUIDE.md for testing instructions
