-- ==========================================================================
-- Migration: 20260920000000_fix_pg_net_schema_in_push_trigger.sql
-- Purpose  : حل نهائي ودقيق لاستدعاء net.http_post
-- ==========================================================================

-- 1. منح الصلاحيات الكاملة على schema net ودوالها
GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA net TO postgres, anon, authenticated, service_role;

SET search_path TO public, net;

-- 2. إعادة بناء دالة التريجر بالتوقيع الدقيق والصلاحيات
CREATE OR REPLACE FUNCTION public.trigger_push_on_notification_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, extensions
AS $$
DECLARE
  v_supabase_url    TEXT := 'https://mecutwhreywjwstirpka.supabase.co';
  v_auth_key        TEXT;
  v_conversation_id TEXT;
  v_url             TEXT;
  v_request_id      BIGINT;
  v_headers         JSONB;
  v_body            JSONB;
BEGIN
  -- ─── 1. جلب الـ service role key ────────────────────────────────────
  BEGIN
    v_auth_key := public.get_vault_secret('SUPABASE_SERVICE_ROLE_KEY');
    IF v_auth_key IS NULL OR v_auth_key = '' THEN
      v_auth_key := public.get_vault_secret('SERVICE_ROLE_JWT');
    END IF;
    IF v_auth_key IS NULL OR v_auth_key = '' THEN
      v_auth_key := public.get_vault_secret('SERVICE_ROLE_KEY');
    END IF;
    IF v_auth_key IS NULL OR v_auth_key = '' THEN
      v_auth_key := public.get_vault_secret('service_role_key');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.push_trigger_errors (notification_id, user_id, error_code, error_message)
    VALUES (NEW.id, NEW.user_id, 'VAULT_READ_EXCEPTION', SQLERRM)
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END;

  IF v_auth_key IS NULL OR v_auth_key = '' THEN
    INSERT INTO public.push_trigger_errors (notification_id, user_id, error_code, error_message)
    VALUES (NEW.id, NEW.user_id, 'NO_SECRETS', 'No valid service_role_key found in Supabase Vault')
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  -- ─── 2. تجهيز الرابط والبيانات ──────────────────────────────────────
  v_url := COALESCE(
    NEW.metadata->>'url',
    CASE NEW.type
      WHEN 'conversation_new_message' THEN '/conversations'
      WHEN 'conversation_admin_reply' THEN '/conversations'
      WHEN 'class_chat_message'       THEN '/conversations'
      WHEN 'teacher_message'          THEN '/messages'
      WHEN 'broadcast_message'        THEN '/messages'
      ELSE '/notifications'
    END
  );

  v_conversation_id := COALESCE(
    NEW.metadata->>'conversation_id',
    NEW.metadata->>'room_id',
    NULL
  );

  v_headers := jsonb_build_object(
    'Content-Type',  'application/json',
    'Authorization', 'Bearer ' || v_auth_key,
    'apikey',        v_auth_key
  );

  v_body := jsonb_build_object(
    'user_id',         NEW.user_id,
    'title',           COALESCE(NEW.title,   'تنبيه جديد'),
    'body',            COALESCE(NEW.message, 'لديك تنبيه جديد'),
    'url',             v_url,
    'type',            COALESCE(NEW.type,    'general'),
    'notification_id', NEW.id,
    'conversation_id', v_conversation_id,
    'urgent', (NEW.type IN (
      'conversation_new_message',
      'conversation_admin_reply',
      'class_chat_message',
      'teacher_message',
      'broadcast_message'
    ))
  );

  -- ─── 3. إرسال الطلب لـ Edge Function عبر net.http_post بالتوقيع الصحيح ───
  BEGIN
    SELECT net.http_post(
      url                  := v_supabase_url || '/functions/v1/send-push-notification',
      body                 := v_body,
      params               := '{}'::jsonb,
      headers              := v_headers,
      timeout_milliseconds := 30000
    ) INTO v_request_id;

    INSERT INTO public.push_delivery_log (
      notification_id, user_id, pg_net_request_id, target_user_id, queued_at
    ) VALUES (
      NEW.id, NEW.user_id, v_request_id, NEW.user_id, NOW()
    ) ON CONFLICT DO NOTHING;

  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.push_trigger_errors (notification_id, user_id, error_code, error_message)
    VALUES (NEW.id, NEW.user_id, 'HTTP_POST_EXCEPTION', SQLERRM)
    ON CONFLICT DO NOTHING;
  END;

  RETURN NEW;
END;
$$;

-- 3. إعادة ربط الـ Trigger
DROP TRIGGER IF EXISTS tr_auto_push_on_notification ON public.notifications;
CREATE TRIGGER tr_auto_push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_on_notification_insert();

REVOKE EXECUTE ON FUNCTION public.trigger_push_on_notification_insert() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.trigger_push_on_notification_insert() TO service_role;

NOTIFY pgrst, 'reload schema';
