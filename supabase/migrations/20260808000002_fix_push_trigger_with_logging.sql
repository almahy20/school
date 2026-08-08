-- ==========================================================================
-- Migration: 20260808000002_fix_push_trigger_with_logging.sql
-- Step     : #2 — Rewrite trigger_push_on_notification_insert() with:
--               • RAISE WARNING (not NOTICE) when vault key missing so the
--                 error surfaces in the Supabase Dashboard Logs at minimum.
--               • INSERT into push_trigger_errors (permanent log) whenever
--                 we would otherwise silently skip a push; this is how the
--                 admin detects misconfigurations.
--               • Capture the BIGINT request_id from net.http_post(...) and
--                 INSERT into push_delivery_log; this allows JOIN-ing later
--                 against net._http_response to see what actual status
--                 code / body the Edge Function returned (was it 200,
--                 401, 403, 500, timeout?). Previously this ID was
--                 discarded via PERFORM and we had zero observability.
-- Based on : The most recent trigger version from migration
--            20260601000000_fix_push_notification_trigger.sql (vault-based).
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.trigger_push_on_notification_insert()
RETURNS trigger AS $$
DECLARE
    v_supabase_url     TEXT;
    v_service_role_key TEXT;
    v_target_url       TEXT;
    v_notification_type TEXT;
    v_request_id       BIGINT;            -- ← pg_net request id returned by net.http_post
BEGIN
    v_supabase_url := 'https://mecutwhreywjwstirpka.supabase.co';

    -- Fetch service_role key from Supabase Vault (Dashboard → Vault → Secrets).
    BEGIN
        SELECT decrypted_secret INTO v_service_role_key
          FROM vault.decrypted_secrets
         WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
         LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        v_service_role_key := NULL;
    END;

    -- ── Guard clause: service_role key NOT in vault ────────────────────
    IF v_service_role_key IS NULL OR length(v_service_role_key) < 20 THEN
        -- (a) Raise at WARNING level so it shows up in Postgres/Supabase logs
        --     (NOTICE is often filtered out by default log levels).
        RAISE WARNING '[Push Trigger] CRITICAL: Service role key missing in vault — SKIPPING push for notification id=%', NEW.id;

        -- (b) Permanent log into push_trigger_errors so the admin can
        --     retroactively see exactly which notifications were dropped,
        --     when, and why — instead of losing the event forever.
        BEGIN
            INSERT INTO public.push_trigger_errors
                (notification_id, user_id, error_code, error_message)
            VALUES
                (NEW.id,
                 NEW.user_id,
                 'VAULT_KEY_MISSING',
                 'SUPABASE_SERVICE_ROLE_KEY is not in vault.decrypted_secrets. Go to Dashboard → Vault → Secrets and add it.');
        EXCEPTION WHEN OTHERS THEN
            -- If the diagnostics INSERT itself fails (e.g. table missing),
            -- fall back to an additional WARNING so we at least still know.
            RAISE WARNING '[Push Trigger] Double failure — could not even INSERT into push_trigger_errors: %', SQLERRM;
        END;

        RETURN NEW;   -- still allow the notification row to exist in DB
    END IF;

    -- ── Determine where the tap on the notification should land ────────
    v_notification_type := NEW.type;
    v_target_url := COALESCE(
        NEW.metadata->>'url',
        CASE
            WHEN NEW.type IN ('teacher_message', 'broadcast_message') THEN '/messages'
            ELSE '/notifications'
        END
    );

    -- ── Call Edge Function via pg_net, CAPTURE request_id ──────────────
    BEGIN
        SELECT net.http_post(
            url     := v_supabase_url || '/functions/v1/send-push-notification',
            headers := jsonb_build_object(
                'Content-Type',  'application/json',
                'Authorization', 'Bearer ' || v_service_role_key,
                'apikey',         v_service_role_key
            ),
            body    := jsonb_build_object(
                'user_id',         NEW.user_id,
                'title',           NEW.title,
                'body',            NEW.message,
                'url',             v_target_url,
                'type',            v_notification_type,
                'notification_id', NEW.id
            )
        ) INTO STRICT v_request_id;   -- ← was previously "PERFORM" (discarded)

        -- (c) Permanent link between notification and pg_net response row.
        --     After the HTTP call completes, the admin runs:
        --       SELECT * FROM public.push_delivery_with_response
        --        WHERE queued_at > NOW() - INTERVAL '1 hour'
        --        ORDER BY queued_at DESC
        --       LIMIT 20;
        --     and sees the actual HTTP status_code + response_body the
        --     Edge Function returned.
        BEGIN
            INSERT INTO public.push_delivery_log
                (notification_id, user_id, pg_net_request_id, target_user_id)
            VALUES
                (NEW.id,
                 NEW.user_id,
                 v_request_id,
                 NEW.user_id);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '[Push Trigger] Failed to INSERT push_delivery_log (notification_id=%, request_id=%): %',
                          NEW.id, v_request_id, SQLERRM;
        END;

        RAISE NOTICE '[Push Trigger] Queued push for notification % (pg_net_request_id=%)', NEW.id, v_request_id;

    EXCEPTION WHEN OTHERS THEN
        -- pg_net itself threw (extension not installed, etc.) — again, we
        -- write a permanent log + WARNING, not just a silent NOTICE.
        RAISE WARNING '[Push Trigger] net.http_post EXCEPTION for notification %: %', NEW.id, SQLERRM;

        BEGIN
            INSERT INTO public.push_trigger_errors
                (notification_id, user_id, error_code, error_message)
            VALUES
                (NEW.id,
                 NEW.user_id,
                 'HTTP_POST_EXCEPTION',
                 'net.http_post raised: ' || left(SQLERRM, 500));
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Re-attach the trigger so the new function body takes effect ────────
-- (DROP + CREATE is idempotent; it also ensures any leftover legacy trigger
--  names are normalised.)
DROP TRIGGER IF EXISTS tr_push_on_notification          ON public.notifications;
DROP TRIGGER IF EXISTS tr_auto_push_on_notification      ON public.notifications;
DROP TRIGGER IF EXISTS tr_push_notification_on_insert    ON public.notifications;
DROP TRIGGER IF EXISTS tr_notification_insert            ON public.notifications;

CREATE TRIGGER tr_auto_push_on_notification
    AFTER INSERT ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_push_on_notification_insert();

NOTIFY pgrst, 'reload schema';
