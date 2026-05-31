-- Migration: 20260601000000_fix_push_notification_trigger.sql
-- Fix: Pass correct `type` and `url` to push notification Edge Function
-- so the Service Worker opens /messages instead of /

-- ✅ Updated trigger: sends type + url so sw.js opens the right page
CREATE OR REPLACE FUNCTION public.trigger_push_on_notification_insert()
RETURNS trigger AS $$
DECLARE
    v_supabase_url TEXT;
    v_service_role_key TEXT;
    v_target_url TEXT;
    v_notification_type TEXT;
BEGIN
    v_supabase_url := 'https://mecutwhreywjwstirpka.supabase.co';

    -- ✅ Use service role key from vault (set via Supabase Dashboard → Vault)
    -- Fallback: read from environment (works in hosted Supabase)
    BEGIN
        SELECT decrypted_secret INTO v_service_role_key
        FROM vault.decrypted_secrets
        WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
        LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        v_service_role_key := NULL;
    END;

    -- If vault not available, skip push (don't hardcode keys in migrations)
    IF v_service_role_key IS NULL THEN
        RAISE NOTICE '[Push Trigger] Service role key not in vault, skipping push for notification %', NEW.id;
        RETURN NEW;
    END IF;

    -- Determine target URL from notification metadata or type
    v_notification_type := NEW.type;
    v_target_url := COALESCE(
        NEW.metadata->>'url',
        CASE
            WHEN NEW.type IN ('teacher_message', 'broadcast_message') THEN '/messages'
            ELSE '/notifications'
        END
    );

    BEGIN
        PERFORM net.http_post(
            url     := v_supabase_url || '/functions/v1/send-push-notification',
            headers := jsonb_build_object(
                'Content-Type',  'application/json',
                'Authorization', 'Bearer ' || v_service_role_key
            ),
            body    := jsonb_build_object(
                'user_id', NEW.user_id,
                'title',   NEW.title,
                'body',    NEW.message,
                'url',     v_target_url,
                'type',    v_notification_type
            )
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[Push Trigger] HTTP call failed: %', SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger (in case it was dropped)
DROP TRIGGER IF EXISTS tr_push_on_notification ON public.notifications;
CREATE TRIGGER tr_push_on_notification
    AFTER INSERT ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_push_on_notification_insert();

NOTIFY pgrst, 'reload schema';
