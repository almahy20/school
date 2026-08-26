-- ==========================================================================
-- Migration: 20260827200000_fix_notification_urls_and_read.sql
-- Purpose  : إصلاح URLs في إشعارات المحادثات + تحسين mark-as-read
-- ==========================================================================

SET search_path TO public;

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 1: إصلاح trigger المحادثات — URL تتضمن conversation_id
-- ═══════════════════════════════════════════════════════════════════════════

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
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'notifications'
    ) INTO v_notif_exists;

    IF NOT v_notif_exists THEN RETURN NEW; END IF;

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
        -- إشعار لكل أدمن في المدرسة — URL تفتح المحادثة مباشرة
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
                        -- URL مباشرة لصفحة المحادثة
                        'url', '/manage-conversations/' || NEW.conversation_id
                    )
                );
            END LOOP;
        END IF;

    ELSIF NEW.sender_role IN ('admin','teacher') THEN
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

DROP TRIGGER IF EXISTS tr_notify_conversation_message ON public.conversation_messages;
CREATE TRIGGER tr_notify_conversation_message
    AFTER INSERT ON public.conversation_messages
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_conversation_message();

REVOKE EXECUTE ON FUNCTION public.notify_on_new_conversation_message() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.notify_on_new_conversation_message() TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 2: index لتسريع query تحديث الإشعارات بـ metadata
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_notifications_user_type_read
  ON public.notifications(user_id, type, is_read)
  WHERE is_read = false;

NOTIFY pgrst, 'reload schema';
