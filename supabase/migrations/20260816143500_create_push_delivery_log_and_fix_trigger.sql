-- Migration: 20260816143500_create_push_delivery_log_and_fix_trigger.sql
-- Goal: Create push_delivery_log table and update DB push trigger to log errors instead of silently swallowing them.

-- 1. Create table push_delivery_log if it does not exist
CREATE TABLE IF NOT EXISTS public.push_delivery_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID REFERENCES public.notifications(id) ON DELETE CASCADE,
    user_id UUID,
    error_message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on push_delivery_log
ALTER TABLE public.push_delivery_log ENABLE ROW LEVEL SECURITY;

-- Allow super_admin to view logs
DROP POLICY IF EXISTS "Super admins can view push delivery logs" ON public.push_delivery_log;
CREATE POLICY "Super admins can view push delivery logs" ON public.push_delivery_log
    FOR SELECT TO authenticated
    USING (public.is_super_admin());

-- Allow service_role full access
DROP POLICY IF EXISTS "Service role manages push delivery logs" ON public.push_delivery_log;
CREATE POLICY "Service role manages push delivery logs" ON public.push_delivery_log
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 2. Update trigger_push_on_notification_insert function
CREATE OR REPLACE FUNCTION public.trigger_push_on_notification_insert()
RETURNS trigger AS $$
DECLARE
    v_supabase_url TEXT;
    v_auth_key TEXT;
BEGIN
    v_supabase_url := 'https://mecutwhreywjwstirpka.supabase.co';

    -- Try to fetch service_role_key from Supabase Vault first, fallback to anon key if not found
    BEGIN
        SELECT TRIM(decrypted_secret) INTO v_auth_key
        FROM vault.decrypted_secrets
        WHERE name IN ('service_role_key', 'supabase_service_role_key')
        ORDER BY name DESC
        LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        v_auth_key := NULL;
    END;

    -- Fallback to anon key if Vault secret is not set
    IF v_auth_key IS NULL OR v_auth_key = '' THEN
        v_auth_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lY3V0d2hyZXl3andzdGlycGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzI5MDEsImV4cCI6MjA5MDQ0ODkwMX0.jlWByWUJI1pTeK_JfFzouD1b5NJC02dE1LILA2iNkII';
    END IF;

    -- Execute HTTP POST via pg_net
    BEGIN
        PERFORM net.http_post(
            url := v_supabase_url || '/functions/v1/send-push-notification',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || v_auth_key
            ),
            body := jsonb_build_object(
                'user_id', NEW.user_id,
                'title', NEW.title,
                'body', NEW.message,
                'url', COALESCE(NEW.metadata->>'url', '/'),
                'type', NEW.type,
                'notification_id', NEW.id
            )
        );
    EXCEPTION WHEN OTHERS THEN
        -- ✅ Priority 2: Log error into push_delivery_log table instead of silently swallowing with RAISE NOTICE
        INSERT INTO public.push_delivery_log (notification_id, user_id, error_message)
        VALUES (NEW.id, NEW.user_id, SQLERRM);
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger
DROP TRIGGER IF EXISTS tr_auto_push_on_notification ON public.notifications;
CREATE TRIGGER tr_auto_push_on_notification
    AFTER INSERT ON public.notifications
    FOR EACH ROW EXECUTE FUNCTION public.trigger_push_on_notification_insert();

NOTIFY pgrst, 'reload schema';
