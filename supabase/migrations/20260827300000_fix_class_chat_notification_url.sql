-- ==========================================================================
-- Migration: 20260827300000_fix_class_chat_notification_url.sql
-- Purpose  : تحديث الـ URL في إشعارات دردشة الفصل ليتوجه مباشرة لصفحة الغرفة
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.notify_class_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room        public.class_chat_rooms%ROWTYPE;
  v_parent_id   UUID;
  v_sender_name TEXT;
BEGIN
  -- جلب بيانات الغرفة
  SELECT * INTO v_room FROM public.class_chat_rooms WHERE id = NEW.room_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- اسم المرسل
  v_sender_name := COALESCE(NEW.sender_name, 'ولي أمر');

  -- إرسال إشعار لكل ولي أمر لديه ابن في هذا الفصل (باستثناء المرسل)
  FOR v_parent_id IN
    SELECT DISTINCT sp.parent_id
    FROM public.student_parents sp
    JOIN public.students s ON s.id = sp.student_id
    WHERE s.class_id  = v_room.class_id
      AND s.school_id = v_room.school_id
      AND sp.parent_id <> NEW.sender_id
  LOOP
    -- تجنب تكرار الإشعار في نفس الـ 5 دقائق
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id    = v_parent_id
        AND type       = 'class_chat_message'
        AND is_read    = FALSE
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
          'url',       '/conversations/class/' || NEW.room_id::text
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- إعادة تسجيل الـ trigger (DROP + CREATE لضمان التحديث)
DROP TRIGGER IF EXISTS tr_notify_class_chat_message ON public.class_chat_messages;
CREATE TRIGGER tr_notify_class_chat_message
  AFTER INSERT ON public.class_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_class_chat_message();

REVOKE EXECUTE ON FUNCTION public.notify_class_chat_message() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.notify_class_chat_message() TO service_role;
