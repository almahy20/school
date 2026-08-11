-- =======================================================
-- 🔧 COMPREHENSIVE DATABASE FIXES MIGRATION
-- Idempotent: safe to run multiple times without errors
-- =======================================================

-- -------------------------------------------------------
-- 1. Extensions: pg_net + vault + pgcrypto + pg_stat_statements
-- -------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" CASCADE;

-- Grant pg_net usage to authenticated / service_role
GRANT USAGE ON SCHEMA extensions TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA extensions TO authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA extensions TO authenticated, service_role;
GRANT INSERT, SELECT ON TABLE extensions.net_request TO authenticated, service_role;

-- -------------------------------------------------------
-- 2. Vault: add VAPID + service role secrets if missing
--    (actual values must be filled in Supabase Vault UI
--     or via SQL with real keys)
-- -------------------------------------------------------
INSERT INTO vault.secrets (secret, name)
SELECT 'REPLACE_WITH_VAPID_PRIVATE_KEY_BASE64_URL', 'VAPID_PRIVATE_KEY'
WHERE NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'VAPID_PRIVATE_KEY');

INSERT INTO vault.secrets (secret, name)
SELECT 'REPLACE_WITH_SERVICE_ROLE_JWT', 'SERVICE_ROLE_JWT'
WHERE NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'SERVICE_ROLE_JWT');

-- -------------------------------------------------------
-- 3. Ensure push tables indexes for performance
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_failure_count ON push_subscriptions(failure_count);
CREATE INDEX IF NOT EXISTS idx_push_delivery_log_notification_id ON push_delivery_log(notification_id);
CREATE INDEX IF NOT EXISTS idx_push_delivery_log_target_user_id ON push_delivery_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_push_trigger_errors_notification_id ON push_trigger_errors(notification_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_school_id ON notifications(school_id);

-- -------------------------------------------------------
-- 4. Robust pg_net-based HTTP queue trigger for push
--    Uses UNNEST for batch safety — never breaks on
--    multi-row inserts. Falls back gracefully if pg_net
--    queueing fails.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_push_v2() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    -- NOTE: This function is a legacy placeholder.
    -- The actual active trigger is notify_push_v2_row() (row-level, uses NEW).
    RETURN NEW;
END;
$$;

-- -------------------------------------------------------
-- 5. DROP-IF-EXISTS + recreate trigger — idempotent
--    Important: we use a transition table ("inserted_cte")
--    so both single-row AND multi-row INSERTs work, plus
--    we reference NEW for single-row fallback if needed.
--
--    Note: Because of transition tables we need to define
--    the trigger carefully. Transition tables CANNOT be
--    referenced inside a FOR EACH ROW trigger directly
--    — they're for STATEMENT triggers. We'll therefore
--    split: a STATEMENT-level trigger for batch work
--    using the transition table (accessed via a wrapper),
--    AND a ROW-level one for safety.
-- -------------------------------------------------------

-- Drop old trigger variants safely
DROP TRIGGER IF EXISTS trg_notifications_push_v2 ON public.notifications;
DROP TRIGGER IF EXISTS trg_notifications_push ON public.notifications;
DROP TRIGGER IF EXISTS trg_notifications_push_v2_stmt ON public.notifications;
DROP TRIGGER IF EXISTS trg_notifications_push_v2_row ON public.notifications;

--
-- Helper ROW-level wrapper that stores NEW into a temp-ish
-- pattern. To keep things SIMPLE and 100% reliable for
-- school app (most inserts are single-row), we re-implement
-- a ROW-level version that operates on NEW (no transition
-- tables needed). This avoids the "inserted_cte undefined"
-- error that would otherwise happen.
--
CREATE OR REPLACE FUNCTION public.notify_push_v2_row() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    _vapid_private_key TEXT;
    _service_role_jwt TEXT;
    _endpoint_url TEXT;
    _sub RECORD;
    _payload JSONB;
    _request_id BIGINT;
    _http_body JSONB;
    _headers JSONB;
    _notif_id UUID;
    _notif_user_id UUID;
    _notif_school_id UUID;
    _notif_title TEXT;
    _notif_message TEXT;
    _notif_type TEXT;
    _notif_link TEXT;
    _notif_metadata JSONB;
BEGIN
    IF TG_OP != 'INSERT' THEN RETURN NEW; END IF;

    _notif_id        := NEW.id;
    _notif_user_id   := NEW.user_id;
    _notif_school_id := NEW.school_id;
    _notif_title     := COALESCE(NEW.title, 'تنبيه جديد');
    _notif_message   := COALESCE(NEW.message, 'لديك تنبيه جديد من المنصة');
    _notif_type      := COALESCE(NEW.type, 'system');
    _notif_link      := NEW.link;
    _notif_metadata  := COALESCE(NEW.metadata, '{}'::jsonb);

    -- Vault secrets
    BEGIN
        SELECT decrypted_secret INTO _vapid_private_key
        FROM vault.decrypted_secrets WHERE name = 'VAPID_PRIVATE_KEY' LIMIT 1;
    EXCEPTION WHEN OTHERS THEN _vapid_private_key := NULL; END;

    BEGIN
        SELECT decrypted_secret INTO _service_role_jwt
        FROM vault.decrypted_secrets WHERE name = 'SERVICE_ROLE_JWT' LIMIT 1;
    EXCEPTION WHEN OTHERS THEN _service_role_jwt := NULL; END;

    _endpoint_url := 'https://mecutwhreywjwstirpka.functions.supabase.co/send-push-notification';

    IF _service_role_jwt IS NULL OR _service_role_jwt = 'REPLACE_WITH_SERVICE_ROLE_JWT' THEN
        INSERT INTO public.push_trigger_errors (notification_id, user_id, error_code, error_message)
        VALUES (_notif_id, _notif_user_id, 'NO_SECRETS',
                'SERVICE_ROLE_JWT Vault secret not configured')
        ON CONFLICT DO NOTHING;
        RETURN NEW;
    END IF;

    FOR _sub IN
        SELECT ps.id, ps.user_id, ps.endpoint, ps.subscription
        FROM public.push_subscriptions ps
        WHERE ps.user_id = _notif_user_id
          AND (ps.failure_count IS NULL OR ps.failure_count < 15)
    LOOP
        _payload := jsonb_build_object(
            'notification', jsonb_build_object(
                'id', _notif_id,
                'title', _notif_title,
                'body', _notif_message,
                'type', _notif_type,
                'link', _notif_link,
                'metadata', _notif_metadata
            ),
            'subscription', _sub.subscription,
            'vapid_private_key', _vapid_private_key,
            'target_endpoint', _sub.endpoint,
            'target_user_id', _sub.user_id,
            'subscription_id', _sub.id,
            'school_id', _notif_school_id
        );

        _headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || _service_role_jwt,
            'apikey', 'Bearer ' || _service_role_jwt,
            'x-region', 'eu-central-1'
        );

        BEGIN
            SELECT extensions.net(
                'POST',
                _endpoint_url,
                _headers,
                _payload,
                NULL::JSONB, NULL::TEXT[],
                55000, FALSE,
                NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT
            ) INTO _request_id;
        EXCEPTION WHEN OTHERS THEN
            INSERT INTO public.push_trigger_errors (notification_id, user_id, error_code, error_message)
            VALUES (_notif_id, _notif_user_id, 'PG_NET_QUEUE_FAIL',
                    SQLERRM || ' [state=' || SQLSTATE || ']')
            ON CONFLICT DO NOTHING;
            CONTINUE;
        END;

        INSERT INTO public.push_delivery_log (
            notification_id, user_id, pg_net_request_id, target_user_id, queued_at
        ) VALUES (
            _notif_id, _notif_user_id, _request_id, _sub.user_id, NOW()
        ) ON CONFLICT DO NOTHING;
    END LOOP;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.push_trigger_errors (notification_id, user_id, error_code, error_message)
    VALUES (NEW.id, NEW.user_id, 'FATAL_TRIGGER',
            'notify_push_v2_row: ' || SQLERRM || ' [state=' || SQLSTATE || ']')
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$;

-- Finally — attach a ROW-level AFTER INSERT trigger
CREATE TRIGGER trg_notifications_push_v2_row
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.notify_push_v2_row();

-- -------------------------------------------------------
-- 6. Fix RLS policies — ensure all new tables have them
-- -------------------------------------------------------

-- push_subscriptions: users manage own; admins read all for school
DROP POLICY IF EXISTS push_subscriptions_self_manage ON push_subscriptions;
CREATE POLICY push_subscriptions_self_manage ON push_subscriptions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS push_subscriptions_admin_school ON push_subscriptions;
CREATE POLICY push_subscriptions_admin_school ON push_subscriptions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role = 'admin'
              AND ur.approval_status = 'approved'
              AND (
                  SELECT profiles.school_id FROM profiles WHERE profiles.id = push_subscriptions.user_id
              ) = ur.school_id
        )
    );

-- push_trigger_errors: service_role + super_admin read only
DROP POLICY IF EXISTS push_trigger_errors_super_admin ON push_trigger_errors;
CREATE POLICY push_trigger_errors_super_admin ON push_trigger_errors
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.is_super_admin = TRUE
        )
    );

-- push_delivery_log: user sees own; super_admin sees all
DROP POLICY IF EXISTS push_delivery_log_self ON push_delivery_log;
CREATE POLICY push_delivery_log_self ON push_delivery_log
    FOR SELECT USING (auth.uid() = target_user_id OR auth.uid() = user_id);

DROP POLICY IF EXISTS push_delivery_log_super_admin ON push_delivery_log;
CREATE POLICY push_delivery_log_super_admin ON push_delivery_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.is_super_admin = TRUE
        )
    );

-- -------------------------------------------------------
-- 7. Retention: auto-clean old error logs after 30 days
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_old_push_logs() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM public.push_trigger_errors WHERE created_at < NOW() - INTERVAL '30 days';
    DELETE FROM public.push_delivery_log  WHERE queued_at   < NOW() - INTERVAL '30 days';
END;
$$;

-- pg_cron job (if pg_cron installed — wrapped in DO block for safety)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-push-logs') THEN
            PERFORM cron.schedule(
                'cleanup-push-logs',
                '0 2 * * *',
                'SELECT public.cleanup_old_push_logs()'
            );
        END IF;
    END IF;
END $$;

-- -------------------------------------------------------
-- 8. Update the "profiles" trigger to ensure
--    last_seen / updated_at / notification_prefs defaults
--    keep working across all updates
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at_profiles()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    IF NEW.notification_prefs IS NULL THEN
        NEW.notification_prefs = '{"grades": true, "system": true, "messages": true, "attendance": true}'::jsonb;
    END IF;
    RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at_profiles();

-- -------------------------------------------------------
-- 9. Notification preferences — helper RPC to let users
--    update their own prefs with proper RLS
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_my_notification_prefs(prefs JSONB)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE profiles
       SET notification_prefs = prefs,
           updated_at = NOW()
     WHERE id = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.update_my_notification_prefs(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_notification_prefs(JSONB) TO authenticated;

-- -------------------------------------------------------
-- 10. Ensure all necessary policies for key tables
-- -------------------------------------------------------

-- notifications: user sees own; admin sees school
DROP POLICY IF EXISTS notifications_self_read ON notifications;
CREATE POLICY notifications_self_read ON notifications
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS notifications_admin_school ON notifications;
CREATE POLICY notifications_admin_school ON notifications
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role = 'admin'
              AND ur.approval_status = 'approved'
              AND ur.school_id = notifications.school_id
        )
    );

DROP POLICY IF EXISTS notifications_insert_service ON notifications;
CREATE POLICY notifications_insert_service ON notifications
    FOR INSERT WITH CHECK (
        auth.role() = 'service_role'
        OR EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
              AND (ur.role = 'admin' OR ur.is_super_admin = TRUE)
              AND ur.approval_status = 'approved'
              AND (ur.school_id = notifications.school_id OR ur.is_super_admin = TRUE)
        )
    );

DROP POLICY IF EXISTS notifications_update_self ON notifications;
CREATE POLICY notifications_update_self ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- -------------------------------------------------------
-- Done.
-- -------------------------------------------------------
