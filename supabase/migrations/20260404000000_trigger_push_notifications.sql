-- 20260404000000_trigger_push_notifications.sql
-- Goal: Automatically trigger the send-push-notification Edge Function when a new notification is created

-- 1. Ensure the pg_net extension is enabled (for making HTTP requests from SQL)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Create the function that will call our Edge Function
CREATE OR REPLACE FUNCTION public.trigger_push_notification_on_insert()
RETURNS trigger AS $$
DECLARE
    v_url TEXT;
    v_body TEXT;
    v_title TEXT;
    v_target_url TEXT;
    v_supabase_url TEXT;
    v_supabase_anon_key TEXT;
BEGIN
    -- Get environment variables (must be set in your Supabase project)
    -- We assume the project URL and anon key are available or use hardcoded if needed for the hook
    -- However, it's safer to use the service role or a specific webhook secret
    
    -- For Supabase Edge Functions, we typically use the internal URL
    -- You'll need to replace these with your actual project details or set them in the vault
    v_supabase_url := 'https://mecutwhreywjwstirpka.supabase.co';
    v_supabase_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lY3V0d2hyZXl3andzdGlycGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzI5MDEsImV4cCI6MjA5MDQ0ODkwMX0.jlWByWUJI1pTeK_JfFzouD1b5NJC02dE1LILA2iNkII'; -- This is the public key from your .env

    v_title := COALESCE(NEW.title, 'إشعار جديد');
    v_body := COALESCE(NEW.content, NEW.message, 'لديك إشعار جديد في إدارة عربية');
    v_target_url := COALESCE(NEW.link, '/');

    -- Perform the HTTP POST request to our Edge Function
    PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/send-push-notification',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_supabase_anon_key
        ),
        body := jsonb_build_object(
            'user_id', NEW.user_id,
            'title', v_title,
            'body', v_body,
            'url', v_target_url
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS tr_push_notification_on_insert ON public.notifications;
CREATE TRIGGER tr_push_notification_on_insert
    AFTER INSERT ON public.notifications
    FOR EACH ROW EXECUTE FUNCTION public.trigger_push_notification_on_insert();
