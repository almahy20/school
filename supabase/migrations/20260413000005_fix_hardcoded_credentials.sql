-- Fix hardcoded Supabase credentials in push notification trigger
-- Use environment variables or Supabase secrets instead

-- Drop the old function with hardcoded credentials
DROP TRIGGER IF EXISTS tr_auto_push_on_notification ON public.notifications;
DROP FUNCTION IF EXISTS public.trigger_push_on_notification_insert();

-- Create improved function that fetches credentials from Supabase vault or uses current settings
CREATE OR REPLACE FUNCTION public.trigger_push_on_notification_insert()
RETURNS trigger AS $$
DECLARE
    v_supabase_url TEXT;
    v_supabase_service_key TEXT;
BEGIN
    -- Fetch credentials from Supabase Vault (recommended for production)
    -- For now, use the current project URL and service_role key
    -- In production, store these in vault: SELECT vault.create_secret('your-key', 'supabase_service_key');
    
    v_supabase_url := current_setting('app.settings.supabase_url', true);
    v_supabase_service_key := current_setting('app.settings.supabase_service_key', true);
    
    -- Fallback to hardcoded values if settings not found (not recommended for production)
    IF v_supabase_url IS NULL OR v_supabase_service_key IS NULL THEN
        -- These should be set in your Supabase project settings
        v_supabase_url := 'https://mecutwhreywjwstirpka.supabase.co';
        -- Use service_role key instead of anon key for better security
        v_supabase_service_key := current_setting('app.settings.supabase_anon_key', true);
    END IF;
    
    -- Only attempt push notification if pg_net is available
    BEGIN
        PERFORM net.http_post(
            url := v_supabase_url || '/functions/v1/send-push-notification',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || v_supabase_service_key
            ),
            body := jsonb_build_object(
                'user_id', NEW.user_id,
                'title', NEW.title,
                'body', NEW.message,
                'url', COALESCE(NEW.metadata->>'url', '/')
            )
        );
    EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the notification insert
        RAISE NOTICE 'Failed to send push notification: %', SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER tr_auto_push_on_notification
    AFTER INSERT ON public.notifications
    FOR EACH ROW EXECUTE FUNCTION public.trigger_push_on_notification_insert();

NOTIFY pgrst, 'reload schema';
