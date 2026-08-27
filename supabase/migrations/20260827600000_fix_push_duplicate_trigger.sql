-- ==========================================================================
-- Migration: 20260827600000_fix_push_duplicate_trigger.sql
-- Purpose  : إصلاح مشكلة الـ push notification المكررة وتحسين الموثوقية
--
-- المشكلة:  فيه trigger مكرر على جدول notifications بيبعت push مرتين:
--   1) tr_auto_push_on_notification → trigger_push_on_notification_insert()
--   2) trg_notifications_push_v2_row → notify_push_v2_row()
--
-- بالإضافة: notify_push_v2_row بيبعت payload مختلف تماماً عن اللي
-- الـ edge function بتتوقعه، يعني كل call منه بيرجع 400 error.
-- ==========================================================================

SET search_path TO public;

-- ─────────────────────────────────────────────────────────────────────────
-- STEP 1: حذف الـ triggers المكررة على notifications
-- ─────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_notifications_push_v2_row  ON public.notifications;
DROP TRIGGER IF EXISTS trg_notifications_push_v2      ON public.notifications;
DROP TRIGGER IF EXISTS trg_notifications_push         ON public.notifications;
DROP TRIGGER IF EXISTS trg_notifications_push_v2_stmt ON public.notifications;

-- حذف الدوال المرتبطة بالـ triggers القديمة
DROP FUNCTION IF EXISTS public.notify_push_v2_row()  CASCADE;
DROP FUNCTION IF EXISTS public.notify_push_v2()      CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- STEP 2: تأكيد إن trigger_push_on_notification_insert موجود ومحدّث
-- بيبحث عن الـ vault secret بكل أسماؤه الممكنة
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_push_on_notification_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url  TEXT := 'https://mecutwhreywjwstirpka.supabase.co';
  v_auth_key      TEXT;
  v_conversation_id TEXT;
  v_url           TEXT;
BEGIN
  -- ابحث عن الـ service role key بكل الأسماء الممكنة في الـ Vault
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
            'No valid service_role_key found in Supabase Vault. Check secrets: SUPABASE_SERVICE_ROLE_KEY, SERVICE_ROLE_JWT')
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  -- استخرج الـ URL من الـ metadata
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

  -- استخرج conversation_id لو موجود في metadata
  v_conversation_id := COALESCE(
    NEW.metadata->>'conversation_id',
    NEW.metadata->>'room_id',
    NULL
  );

  BEGIN
    PERFORM net.http_post(
      url     := v_supabase_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'Authorization',  'Bearer ' || v_auth_key,
        'apikey',         v_auth_key
      ),
      body := jsonb_build_object(
        'user_id',          NEW.user_id,
        'title',            COALESCE(NEW.title, 'تنبيه جديد'),
        'body',             COALESCE(NEW.message, 'لديك تنبيه جديد'),
        'url',              v_url,
        'type',             COALESCE(NEW.type, 'general'),
        'notification_id',  NEW.id,
        'conversation_id',  v_conversation_id,
        'urgent',           (NEW.type IN (
                              'conversation_new_message',
                              'conversation_admin_reply',
                              'class_chat_message',
                              'teacher_message',
                              'broadcast_message'
                            ))
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- سجّل الخطأ بدل ما يفشل الـ INSERT الأصلي
    INSERT INTO public.push_trigger_errors (notification_id, user_id, error_code, error_message)
    VALUES (NEW.id, NEW.user_id, 'HTTP_POST_EXCEPTION', SQLERRM)
    ON CONFLICT DO NOTHING;
  END;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- STEP 3: أنشئ trigger واحد فقط — بعد ما حذفنا القديمة
-- ─────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS tr_auto_push_on_notification ON public.notifications;

CREATE TRIGGER tr_auto_push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_on_notification_insert();

-- ─────────────────────────────────────────────────────────────────────────
-- STEP 4: تحقق — يجب إن يكون في trigger واحد فقط
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_count INTEGER;
  v_names TEXT;
BEGIN
  SELECT COUNT(*), string_agg(trigger_name, ', ')
  INTO v_count, v_names
  FROM information_schema.triggers
  WHERE event_object_schema = 'public'
    AND event_object_table  = 'notifications'
    AND action_orientation  = 'ROW';

  IF v_count = 1 THEN
    RAISE NOTICE '✅ تم: يوجد trigger واحد فقط على notifications: %', v_names;
  ELSIF v_count = 0 THEN
    RAISE WARNING '⚠️ لا يوجد أي trigger على notifications!';
  ELSE
    RAISE WARNING '⚠️ يوجد % triggers على notifications: % — راجع يدوياً', v_count, v_names;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- STEP 5: تأكد من صلاحيات الدالة
-- ─────────────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.trigger_push_on_notification_insert() FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.trigger_push_on_notification_insert() TO service_role;

NOTIFY pgrst, 'reload schema';
