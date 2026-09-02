-- ==========================================================================
-- Migration: 20260910100000_fix_vault_secret_grant_and_triggers.sql
-- Purpose  : إصلاح خطأين ظهرا في اللوجات:
--
--   1) error 42883: function public.get_vault_secret(unknown) does not exist
--      السبب الجذري: مايجريشن 20260819160000 نفّذ:
--        REVOKE EXECUTE ON FUNCTION public.get_vault_secret(text)
--        FROM PUBLIC, anon, authenticated;
--      ثم مايجريشن 20260819161000 أعاد search_path لكنه لم يُعِد الـ GRANT.
--      الـ trigger يستدعي get_vault_secret من سياق SECURITY DEFINER لكن
--      الـ REVOKE يمنع حتى هذا الاستدعاء — فيظهر الخطأ "unknown" بدل "text"
--      لأن Postgres لا يجد الدالة أصلاً في pg_catalog لمستوى الصلاحية الحالي.
--
--   2) warning 404: POST /rest/v1/conversation_messages
--      السبب: الـ trigger tr_notify_conversation_message يُنفّذ
--      notify_on_new_conversation_message التي تستدعي get_vault_secret
--      بشكل غير مباشر (عبر INSERT في notifications → trigger آخر).
--      لما get_vault_secret تفشل بـ 42883 خارج أي BEGIN/EXCEPTION block →
--      يُلغي الـ transaction كاملاً → PostgREST يُرجع 404 على الـ INSERT
--      الأصلي في conversation_messages.
--
-- الإصلاحات:
--   1. إعادة بناء get_vault_secret مع search_path صحيح + إعادة الـ GRANTs
--   2. إعادة بناء trigger_push_on_notification_insert بـ exception handler شامل
--   3. إعادة بناء notify_on_new_conversation_message بإحاطة الجسم كله
--      بـ BEGIN/EXCEPTION حتى أي خطأ لا يُلغي الـ INSERT الأصلي
-- ==========================================================================

SET search_path TO public;

-- ==========================================================================
-- 1. إعادة بناء get_vault_secret مع search_path وصلاحيات صحيحة
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.get_vault_secret(p_secret_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
BEGIN
  -- البحث بكل التوليفات الممكنة من الأسماء (case-insensitive)
  SELECT TRIM(decrypted_secret) INTO v_secret
  FROM vault.decrypted_secrets
  WHERE lower(name) = lower(p_secret_name)
     OR lower(name) = lower('supabase_' || p_secret_name)
  ORDER BY
    CASE WHEN lower(name) = lower(p_secret_name) THEN 0 ELSE 1 END
  LIMIT 1;

  RETURN v_secret;
EXCEPTION WHEN OTHERS THEN
  -- لا نُوقف أي عملية بسبب فشل قراءة الـ vault
  RETURN NULL;
END;
$$;

-- إعادة الـ GRANTs التي سحبها 20260819160000
-- service_role: ضروري للـ triggers التي تشتغل في هذا السياق
-- authenticated: للاستدعاء من edge functions إن لزم
GRANT  EXECUTE ON FUNCTION public.get_vault_secret(text) TO service_role;
GRANT  EXECUTE ON FUNCTION public.get_vault_secret(text) TO authenticated;

-- الأمان: لا يزال مسحوباً من anon و PUBLIC
REVOKE EXECUTE ON FUNCTION public.get_vault_secret(text) FROM anon, PUBLIC;

-- ==========================================================================
-- 2. إعادة بناء trigger_push_on_notification_insert
--    الإصلاح: كل استدعاء لـ get_vault_secret داخل BEGIN/EXCEPTION منفصل
--    + exception handler خارجي يمنع إلغاء الـ INSERT في notifications
-- ==========================================================================

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
  -- ─── جلب الـ service role key ────────────────────────────────────────
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
    RETURN NEW;  -- لا نُلغي الـ INSERT في notifications
  END;

  IF v_auth_key IS NULL OR v_auth_key = '' THEN
    INSERT INTO public.push_trigger_errors (notification_id, user_id, error_code, error_message)
    VALUES (NEW.id, NEW.user_id, 'NO_SECRETS',
            'No valid service_role_key found in Supabase Vault')
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  -- ─── URL و conversation_id ────────────────────────────────────────────
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

  -- ─── HTTP POST إلى Edge Function ────────────────────────────────────
  BEGIN
    SELECT net.http_post(
      url     := v_supabase_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_auth_key,
        'apikey',        v_auth_key
      ),
      body := jsonb_build_object(
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

DROP TRIGGER IF EXISTS tr_auto_push_on_notification ON public.notifications;
CREATE TRIGGER tr_auto_push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_on_notification_insert();

REVOKE EXECUTE ON FUNCTION public.trigger_push_on_notification_insert() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.trigger_push_on_notification_insert() TO service_role;

-- ==========================================================================
-- 3. إعادة بناء notify_on_new_conversation_message
--    الإصلاح الجوهري: إحاطة الجسم كاملاً بـ BEGIN/EXCEPTION
--    → أي خطأ (بما فيه فشل get_vault_secret) يُسجَّل كـ WARNING فقط
--    → الـ INSERT في conversation_messages لا يُلغى → يُصلح الـ 404
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.notify_on_new_conversation_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv         RECORD;
  v_admin_id     UUID;
  v_sender_name  TEXT;
  v_notif_exists BOOLEAN;
BEGIN
  BEGIN  -- ← exception handler شامل يمنع إلغاء الـ transaction الأصلية

    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'notifications'
    ) INTO v_notif_exists;

    IF NOT v_notif_exists THEN
      RETURN NEW;
    END IF;

    SELECT * INTO v_conv FROM public.conversations WHERE id = NEW.conversation_id;
    IF NOT FOUND THEN RETURN NEW; END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'profiles'
    ) THEN
      SELECT full_name INTO v_sender_name
      FROM public.profiles WHERE id = NEW.sender_id;
    END IF;

    IF NEW.sender_role = 'parent' THEN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'user_roles'
      ) THEN
        FOR v_admin_id IN (
          SELECT user_id FROM public.user_roles
          WHERE school_id = v_conv.school_id AND role = 'admin'
        ) LOOP
          INSERT INTO public.notifications
            (user_id, school_id, type, title, message, metadata)
          VALUES (
            v_admin_id,
            v_conv.school_id,
            'conversation_new_message',
            'رسالة جديدة من ' || COALESCE(v_sender_name, 'ولي أمر'),
            LEFT(COALESCE(NEW.content, ''), 80),
            jsonb_build_object(
              'conversation_id', NEW.conversation_id,
              'message_id',      NEW.id,
              'parent_id',       v_conv.parent_id,
              'url',             '/manage-conversations/' || NEW.conversation_id
            )
          );
        END LOOP;
      END IF;

    ELSIF NEW.sender_role IN ('admin', 'teacher') THEN
      INSERT INTO public.notifications
        (user_id, school_id, type, title, message, metadata)
      VALUES (
        v_conv.parent_id,
        v_conv.school_id,
        'conversation_admin_reply',
        'رد جديد من إدارة المدرسة',
        LEFT(COALESCE(NEW.content, ''), 80),
        jsonb_build_object(
          'conversation_id', NEW.conversation_id,
          'message_id',      NEW.id,
          'url',             '/conversations'
        )
      );
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- الأهم: RAISE WARNING بدل RAISE EXCEPTION
    -- WARNING لا يُلغي الـ transaction — EXCEPTION يُلغيها
    RAISE WARNING 'notify_on_new_conversation_message error (SQLSTATE %): %',
      SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_conversation_message ON public.conversation_messages;
CREATE TRIGGER tr_notify_conversation_message
  AFTER INSERT ON public.conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_new_conversation_message();

REVOKE EXECUTE ON FUNCTION public.notify_on_new_conversation_message() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.notify_on_new_conversation_message() TO service_role;

-- ==========================================================================
-- 4. ضمان grants على conversation_messages
-- ==========================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_messages TO service_role;

-- ==========================================================================
-- 5. تحديث الإحصائيات وإعادة تحميل schema cache
-- ==========================================================================

ANALYZE public.notifications;
ANALYZE public.conversation_messages;

NOTIFY pgrst, 'reload schema';
