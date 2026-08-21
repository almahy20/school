-- ═══════════════════════════════════════════════════════════════════════════
-- Fix: تصحيح إشعارات المحادثات القديمة التي تحتوي على نصوص مشوهة
-- وتحديث trigger الإشعارات ليكون أوضح
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. تصحيح الإشعارات القديمة (مع فحص وجود الجدول أولاً)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) THEN
    UPDATE public.notifications
    SET
      title = CASE type
        WHEN 'conversation_admin_reply' THEN 'رد جديد من إدارة المدرسة'
        WHEN 'conversation_new_message' THEN 'رسالة جديدة من ولي أمر'
        ELSE title
      END,
      message = CASE
        WHEN message ~ '[?]{3,}' THEN 'اضغط لعرض الرسالة'
        ELSE message
      END
    WHERE
      type IN ('conversation_admin_reply', 'conversation_new_message')
      AND (
        title   ~ '[?]{3,}' OR
        message ~ '[?]{3,}' OR
        title   IS NULL      OR
        message IS NULL
      );
  END IF;
END $$;

-- 2. إعادة كتابة trigger function بطريقة أكثر أماناً (UTF-8 safe)
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
BEGIN
    -- جلب بيانات المحادثة
    SELECT * INTO v_conv
    FROM public.conversations
    WHERE id = NEW.conversation_id;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    -- جلب اسم المرسل من profiles
    SELECT COALESCE(full_name, 'مجهول')
    INTO v_sender_name
    FROM public.profiles
    WHERE id = NEW.sender_id;

    IF v_sender_name IS NULL THEN
        v_sender_name := 'مجهول';
    END IF;

    IF NEW.sender_role = 'parent' THEN
        -- إشعار لكل أدمن في المدرسة
        FOR v_admin_id IN (
            SELECT user_id
            FROM public.user_roles
            WHERE school_id = v_conv.school_id
              AND role = 'admin'
        ) LOOP
            INSERT INTO public.notifications
                (user_id, school_id, type, title, message, metadata)
            VALUES (
                v_admin_id,
                v_conv.school_id,
                'conversation_new_message',
                'رسالة جديدة من ' || v_sender_name,
                LEFT(COALESCE(NEW.content, ''), 80),
                jsonb_build_object(
                    'conversation_id', NEW.conversation_id,
                    'message_id',      NEW.id,
                    'parent_id',       v_conv.parent_id,
                    'url',             '/manage-conversations/' || NEW.conversation_id
                )
            );
        END LOOP;

    ELSIF NEW.sender_role IN ('admin', 'teacher') THEN
        -- إشعار لولي الأمر
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

    RETURN NEW;
END;
$$;

-- إعادة ربط الـ trigger (فقط لو الجدول موجود)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'conversation_messages'
  ) THEN
    DROP TRIGGER IF EXISTS tr_notify_conversation_message ON public.conversation_messages;
    CREATE TRIGGER tr_notify_conversation_message
        AFTER INSERT ON public.conversation_messages
        FOR EACH ROW
        EXECUTE FUNCTION public.notify_on_new_conversation_message();
  END IF;
END $$;
