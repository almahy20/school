-- =======================================================
-- 🔧 MIGRATION: Fix pg_net function call schema
-- Path: supabase/migrations/20260810300000_fix_pg_net_schema_and_function.sql
-- Description: Detects pg_net schema dynamically and uses
--              the standard http_post function instead of
--              the hardcoded (and often missing) extensions.net.
-- =======================================================

CREATE OR REPLACE FUNCTION public.notify_push_v2_row() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    _vapid_private_key TEXT;
    _service_role_jwt TEXT;
    _endpoint_url TEXT;
    _sub RECORD;
    _payload JSONB;
    _request_id BIGINT;
    _headers JSONB;
    _notif_id UUID;
    _notif_user_id UUID;
    _notif_school_id UUID;
    _notif_title TEXT;
    _notif_message TEXT;
    _notif_type TEXT;
    _notif_link TEXT;
    _notif_metadata JSONB;
    _pg_net_schema TEXT;
    _query TEXT;
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

    -- 1. Fetch Vault secrets
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

    -- 2. Detect pg_net schema dynamically
    SELECT n.nspname INTO _pg_net_schema
      FROM pg_extension e
      JOIN pg_namespace n ON e.extnamespace = n.oid
     WHERE e.extname = 'pg_net'
     LIMIT 1;

    _pg_net_schema := COALESCE(_pg_net_schema, 'net');

    -- 3. Loop through active subscriptions and enqueue push notification requests
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
            -- Dynamically construct and execute the http_post call based on the detected pg_net schema
            _query := format(
                'SELECT %I.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 55000)',
                _pg_net_schema
            );
            EXECUTE _query USING _endpoint_url, _payload, _headers INTO _request_id;
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
