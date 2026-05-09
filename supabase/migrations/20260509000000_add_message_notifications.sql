-- Migration: 20260509000000_add_message_notifications.sql
-- Goal: Add automatic notifications for new messages

-- 1. Trigger for New Messages
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger AS $$
DECLARE
    v_sender_name text;
    v_school_id uuid;
BEGIN
    -- Get sender name
    SELECT full_name INTO v_sender_name FROM public.profiles WHERE id = NEW.sender_id;
    
    -- Get school_id from sender
    SELECT school_id INTO v_school_id FROM public.profiles WHERE id = NEW.sender_id;

    -- Insert notification for the receiver
    INSERT INTO public.notifications (user_id, school_id, type, title, message, metadata)
    VALUES (
        NEW.receiver_id,
        v_school_id,
        'broadcast_message',
        'رسالة جديدة من ' || COALESCE(v_sender_name, 'مستخدم'),
        substring(NEW.content from 1 for 100), -- Send first 100 chars
        jsonb_build_object('message_id', NEW.id, 'sender_id', NEW.sender_id, 'url', '/messages')
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS tr_notify_new_message ON public.messages;
CREATE TRIGGER tr_notify_new_message
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();

-- 3. Update the push notification trigger to ensure it uses the latest URL and handling
-- (Optional but good for consistency)
CREATE OR REPLACE FUNCTION public.trigger_push_on_notification_insert()
RETURNS trigger AS $$
DECLARE
    v_supabase_url TEXT;
    v_supabase_anon_key TEXT;
BEGIN
    -- These should ideally be retrieved from vault, but we keep the current pattern for compatibility
    v_supabase_url := 'https://mecutwhreywjwstirpka.supabase.co';
    v_supabase_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lY3V0d2hyZXl3andzdGlycGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzI5MDEsImV4cCI6MjA5MDQ0ODkwMX0.jlWByWUJI1pTeK_JfFzouD1b5NJC02dE1LILA2iNkII';

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
        RAISE NOTICE 'Failed to send push notification: %', SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
