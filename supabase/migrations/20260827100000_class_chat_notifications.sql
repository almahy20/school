-- ==========================================================================
-- Migration: 20260827100000_class_chat_notifications.sql
-- Purpose  : إشعارات لأولياء الأمور عند وصول رسائل جديدة في دردشة الفصل
--            + إصلاح الـ Realtime على class_chat_messages
-- ==========================================================================

SET search_path TO public;

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 1: Trigger — إشعار أولياء الأمور عند رسالة جديدة في الفصل
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_class_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room          RECORD;
  v_parent_id     UUID;
  v_sender_name   TEXT;
  v_notif_exists  BOOLEAN;
BEGIN
  -- هل جدول notifications موجود؟
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) INTO v_notif_exists;

  IF NOT v_notif_exists THEN RETURN NEW; END IF;

  -- جلب بيانات الغرفة
  SELECT * INTO v_room FROM public.class_chat_rooms WHERE id = NEW.room_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- اسم المُرسِل
  v_sender_name := COALESCE(NEW.sender_name, 'ولي أمر');

  -- إرسال إشعار لكل ولي أمر في الفصل (عدا المُرسِل نفسه)
  FOR v_parent_id IN (
    SELECT DISTINCT sp.parent_id
    FROM public.student_parents sp
    JOIN public.students s ON s.id = sp.student_id
    WHERE s.class_id   = v_room.class_id
      AND sp.school_id = v_room.school_id
      AND sp.parent_id != NEW.sender_id  -- لا نُرسل للمُرسِل نفسه
  )
  LOOP
    -- تجنب إغراق الإشعارات — رسالة واحدة كل 5 دقائق لنفس المُرسِل
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id    = v_parent_id
        AND type       = 'class_chat_message'
        AND metadata->>'room_id' = NEW.room_id::text
        AND created_at > NOW() - INTERVAL '5 minutes'
    ) THEN
      INSERT INTO public.notifications
        (user_id, school_id, type, title, message, metadata)
      VALUES (
        v_parent_id,
        v_room.school_id,
        'class_chat_message',
        'رسالة جديدة في دردشة الفصل',
        v_sender_name || ': ' || LEFT(COALESCE(NEW.content, ''), 80),
        jsonb_build_object(
          'room_id',   NEW.room_id,
          'sender_id', NEW.sender_id,
          'url',       '/conversations'
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_class_chat_message ON public.class_chat_messages;
CREATE TRIGGER tr_notify_class_chat_message
  AFTER INSERT ON public.class_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_class_chat_message();

REVOKE EXECUTE ON FUNCTION public.notify_class_chat_message() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.notify_class_chat_message() TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 2: إضافة class_chat_message لأنواع الإشعارات في RealtimeNotificationsManager
--         (نضمن أن REPLICA IDENTITY FULL مفعّل لجميع جداول الدردشة)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.class_chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.class_chat_rooms    REPLICA IDENTITY FULL;

-- تأكد إن الجداول في الـ publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.class_chat_messages;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.class_chat_rooms;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 3: إشعار المحادثة الخاصة — تأكيد أن unread_by_parent يُحدَّث صح
--         (كان موجود في migration conversations لكن نتحقق)
-- ═══════════════════════════════════════════════════════════════════════════

-- الـ trigger update_conversation_on_new_message موجود بالفعل ويُحدِّث unread_by_parent
-- نضيف فقط index لتحسين الأداء على الـ query بتاع unread_by_parent
CREATE INDEX IF NOT EXISTS idx_conversations_parent_unread
  ON public.conversations(parent_id, unread_by_parent)
  WHERE unread_by_parent > 0;

CREATE INDEX IF NOT EXISTS idx_conversations_admin_unread
  ON public.conversations(school_id, unread_by_admin)
  WHERE unread_by_admin > 0;

NOTIFY pgrst, 'reload schema';
