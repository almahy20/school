-- Migration: 20260816144000_seed_vault_anon_key_and_clean_secrets.sql
-- Goal: Ensure secrets in DB functions use Supabase Vault dynamically without hardcoded plaintext keys.

-- 1. Create a helper DB function to fetch Vault secrets safely
CREATE OR REPLACE FUNCTION public.get_vault_secret(p_secret_name text)
RETURNS text AS $$
DECLARE
    v_secret text;
BEGIN
    SELECT TRIM(decrypted_secret) INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = p_secret_name
    LIMIT 1;

    RETURN v_secret;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update trigger_push_on_notification_insert to use get_vault_secret
CREATE OR REPLACE FUNCTION public.trigger_push_on_notification_insert()
RETURNS trigger AS $$
DECLARE
    v_supabase_url TEXT;
    v_auth_key TEXT;
BEGIN
    v_supabase_url := 'https://mecutwhreywjwstirpka.supabase.co';

    -- Priority A: Use service_role_key from Vault
    v_auth_key := public.get_vault_secret('service_role_key');

    -- Priority B: Fallback to supabase_service_role_key from Vault
    IF v_auth_key IS NULL OR v_auth_key = '' THEN
        v_auth_key := public.get_vault_secret('supabase_service_role_key');
    END IF;

    -- Priority C: Fallback to anon_key from Vault
    IF v_auth_key IS NULL OR v_auth_key = '' THEN
        v_auth_key := public.get_vault_secret('anon_key');
    END IF;

    -- Execute HTTP POST via pg_net
    IF v_auth_key IS NOT NULL AND v_auth_key <> '' THEN
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
            INSERT INTO public.push_delivery_log (notification_id, user_id, error_message)
            VALUES (NEW.id, NEW.user_id, SQLERRM);
        END;
    ELSE
        INSERT INTO public.push_delivery_log (notification_id, user_id, error_message)
        VALUES (NEW.id, NEW.user_id, 'No valid authorization key found in Supabase Vault (service_role_key or anon_key)');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
