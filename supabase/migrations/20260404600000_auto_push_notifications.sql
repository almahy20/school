-- Migration: 20260404600000_auto_push_notifications.sql
-- Goal: Automatically send a Web Push notification whenever a new record is added to the notifications table

-- 1. Create the function that calls the send-push-notification Edge Function
CREATE OR REPLACE FUNCTION public.trigger_push_on_notification_insert()
RETURNS trigger AS $$
DECLARE
    v_supabase_url TEXT;
    v_supabase_anon_key TEXT;
BEGIN
    -- These should be set in your environment, but for the trigger we use the internal project values
    -- Replace with your actual project URL if needed, or use the vault
    v_supabase_url := 'https://mecutwhreywjwstirpka.supabase.co';
    -- Using the anon key for the function call (ensure the function allows it or use service role)
    v_supabase_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lY3V0d2hyZXl3andzdGlycGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzI5MDEsImV4cCI6MjA5MDQ0ODkwMX0.jlWByWUJI1pTeK_JfFzouD1b5NJC02dE1LILA2iNkII';

    -- Call the Edge Function
    PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/send-push-notification',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_supabase_anon_key
        ),
        body := jsonb_build_object(
            'user_id', NEW.user_id,
            'title', NEW.title,
            'body', NEW.message,
            'url', COALESCE(NEW.metadata->>'url', '/')
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger on the notifications table
DROP TRIGGER IF EXISTS tr_auto_push_on_notification ON public.notifications;
CREATE TRIGGER tr_auto_push_on_notification
    AFTER INSERT ON public.notifications
    FOR EACH ROW EXECUTE FUNCTION public.trigger_push_on_notification_insert();

-- 3. Update existing triggers to ensure they don't manually call the Edge Function if they were doing so
-- (Most of our triggers only insert into public.notifications, which is perfect now)

NOTIFY pgrst, 'reload schema';
