-- ==========================================================================
-- Migration: 20260830000000_fix_uuid_text_operator_and_curriculum_rpc.sql
-- Purpose  : 
--   1. Fix PostgreSQL error 42883 ("operator does not exist: uuid = text")
--      by defining universal immutable equality and inequality operators
--      between UUID and TEXT in public schema.
--   2. Define get_class_curriculum_status(uuid) RPC function with robust type casting.
--   3. Ensure proper permissions and reload PostgREST schema cache.
-- ==========================================================================

SET search_path TO public;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Create Universal Safe Comparison Operators for UUID = TEXT & TEXT = UUID
-- ─────────────────────────────────────────────────────────────────────────

-- Safe UUID vs Text Equality
CREATE OR REPLACE FUNCTION public.uuid_eq_text(p_uuid uuid, p_text text)
RETURNS boolean AS $$
BEGIN
  IF p_text IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN p_uuid::text = p_text;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path = public;

-- Safe Text vs UUID Equality
CREATE OR REPLACE FUNCTION public.text_eq_uuid(p_text text, p_uuid uuid)
RETURNS boolean AS $$
BEGIN
  IF p_text IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN p_text = p_uuid::text;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path = public;

-- Safe UUID vs Text Inequality
CREATE OR REPLACE FUNCTION public.uuid_ne_text(p_uuid uuid, p_text text)
RETURNS boolean AS $$
BEGIN
  IF p_text IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN p_uuid::text <> p_text;
EXCEPTION WHEN OTHERS THEN
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path = public;

-- Safe Text vs UUID Inequality
CREATE OR REPLACE FUNCTION public.text_ne_uuid(p_text text, p_uuid uuid)
RETURNS boolean AS $$
BEGIN
  IF p_text IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN p_text <> p_uuid::text;
EXCEPTION WHEN OTHERS THEN
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path = public;

-- Register Equality Operators
DROP OPERATOR IF EXISTS = (uuid, text);
CREATE OPERATOR = (
  LEFTARG = uuid,
  RIGHTARG = text,
  PROCEDURE = public.uuid_eq_text,
  COMMUTATOR = =,
  NEGATOR = <>,
  RESTRICT = eqsel,
  JOIN = eqjoinsel
);

DROP OPERATOR IF EXISTS = (text, uuid);
CREATE OPERATOR = (
  LEFTARG = text,
  RIGHTARG = uuid,
  PROCEDURE = public.text_eq_uuid,
  COMMUTATOR = =,
  NEGATOR = <>,
  RESTRICT = eqsel,
  JOIN = eqjoinsel
);

-- Register Inequality Operators
DROP OPERATOR IF EXISTS <> (uuid, text);
CREATE OPERATOR <> (
  LEFTARG = uuid,
  RIGHTARG = text,
  PROCEDURE = public.uuid_ne_text,
  COMMUTATOR = <>,
  NEGATOR = =,
  RESTRICT = neqsel,
  JOIN = neqjoinsel
);

DROP OPERATOR IF EXISTS <> (text, uuid);
CREATE OPERATOR <> (
  LEFTARG = text,
  RIGHTARG = uuid,
  PROCEDURE = public.text_ne_uuid,
  COMMUTATOR = <>,
  NEGATOR = =,
  RESTRICT = neqsel,
  JOIN = neqjoinsel
);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Create or Replace get_class_curriculum_status RPC
-- ─────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_class_curriculum_status(uuid);

CREATE OR REPLACE FUNCTION public.get_class_curriculum_status(p_class_id uuid)
RETURNS TABLE (
    subject_name text,
    content text,
    progress integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_curriculum_id uuid;
BEGIN
    -- جلب منهج الفصل
    SELECT curriculum_id INTO v_curriculum_id
    FROM public.classes
    WHERE id = p_class_id;

    IF v_curriculum_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        cs.subject_name::text,
        COALESCE(cs.content, '')::text AS content,
        0::integer AS progress
    FROM public.curriculum_subjects cs
    WHERE cs.curriculum_id = v_curriculum_id
    ORDER BY cs.subject_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_class_curriculum_status(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_class_curriculum_status(uuid) FROM anon;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Validate & Enhance Class Chat Notification Trigger (Strict Type Safety)
-- ─────────────────────────────────────────────────────────────────────────

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
    -- تجنب تكرار الإشعار في نفس الـ 5 دقائق (تحويل صريح للنص لتجنب 42883)
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
          'room_id',   NEW.room_id::text,
          'sender_id', NEW.sender_id::text,
          'url',       '/conversations/class/' || NEW.room_id::text
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

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Reload PostgREST Cache
-- ─────────────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
