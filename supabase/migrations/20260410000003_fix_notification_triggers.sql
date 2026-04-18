-- Fix notification triggers - remove any trigger that tries to access NEW.content

-- Drop all existing notification triggers
DROP TRIGGER IF EXISTS tr_push_notification_on_insert ON public.notifications;
DROP TRIGGER IF EXISTS tr_auto_push_on_notification ON public.notifications;
DROP TRIGGER IF EXISTS tr_notification_insert ON public.notifications;

-- Recreate the safe push notification trigger (doesn't use NEW.content)
CREATE OR REPLACE FUNCTION public.trigger_push_on_notification_insert()
RETURNS trigger AS $$
DECLARE
    v_supabase_url TEXT;
    v_supabase_anon_key TEXT;
BEGIN
    v_supabase_url := 'https://mecutwhreywjwstirpka.supabase.co';
    v_supabase_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lY3V0d2hyZXl3andzdGlycGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzI5MDEsImV4cCI6MjA5MDQ0ODkwMX0.jlWByWUJI1pTeK_JfFzouD1b5NJC02dE1LILA2iNkII';

    -- Try to send push notification, but don't fail if pg_net is not available
    BEGIN
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
