-- ==========================================================================
-- Migration: 20260901200000_fix_push_trigger_timeout.sql
-- Purpose  : زيادة timeout الـ pg_net request من 5s الى 30s
--            السبب: Edge Function بتاخد وقت اطول من 5s للاتصال بـ FCM/web-push
--            النتيجة الحالية: 50% من الإشعارات بتـ timeout قبل ما توصل
-- ==========================================================================

SET search_path TO public;

CREATE OR REPLACE FUNCTION public.trigger_push_on_notification_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url    TEXT := 'https://mecutwhreywjwstirpka.supabase.co';
  v_auth_key        TEXT;
  v_conversation_id TEXT;
  v_url             TEXT;
  v_request_id      BIGINT;
BEGIN
  -- جلب الـ service role key من الـ Vault
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

  IF v_auth_key IS NULL OR v_auth_key = '' THEN
    INSERT INTO public.push_trigger_errors (notification_id, user_id, error_code, error_message)
    VALUES (NEW.id, NEW.user_id, 'NO_SECRETS',
            'No valid service_role_key found in Supabase Vault')
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  -- تحديد الـ URL حسب نوع الإشعار
  v_url := COALESCE(
    NEW.metadata->>'url',
    CASE NEW.type
      WHEN 'conversation_new_message'  THEN '/conversations'
      WHEN 'conversation_admin_reply'  THEN '/conversations'
      WHEN 'class_chat_message'        THEN '/conversations'
      WHEN 'teacher_message'           THEN '/messages'
      WHEN 'broadcast_message'         THEN '/messages'
      ELSE '/notifications'
    END
  );

  v_conversation_id := COALESCE(
    NEW.metadata->>'conversation_id',
    NEW.metadata->>'room_id',
    NULL
  );

  BEGIN
    -- ✅ timeout رُفع من 5000ms الى 30000ms لمنع الـ timeout مع FCM/web-push
    SELECT net.http_post(
      url     := v_supabase_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'Authorization',  'Bearer ' || v_auth_key,
        'apikey',         v_auth_key
      ),
      body := jsonb_build_object(
        'user_id',         NEW.user_id,
        'title',           COALESCE(NEW.title, 'تنبيه جديد'),
        'body',            COALESCE(NEW.message, 'لديك تنبيه جديد'),
        'url',             v_url,
        'type',            COALESCE(NEW.type, 'general'),
        'notification_id', NEW.id,
        'conversation_id', v_conversation_id,
        'urgent',          (NEW.type IN (
                             'conversation_new_message',
                             'conversation_admin_reply',
                             'class_chat_message',
                             'teacher_message',
                             'broadcast_message'
                           ))
      ),
      timeout_milliseconds := 30000
    ) INTO v_request_id;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.push_trigger_errors (notification_id, user_id, error_code, error_message)
    VALUES (NEW.id, NEW.user_id, 'HTTP_POST_EXCEPTION', SQLERRM)
    ON CONFLICT DO NOTHING;
  END;

  RETURN NEW;
END;
$$;

-- التأكد من إن الـ trigger موجود
DROP TRIGGER IF EXISTS tr_auto_push_on_notification ON public.notifications;
CREATE TRIGGER tr_auto_push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_on_notification_insert();

NOTIFY pgrst, 'reload schema';
