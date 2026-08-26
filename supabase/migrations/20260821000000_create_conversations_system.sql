-- ==========================================================================
-- Migration: 20260821000000_create_conversations_system.sql
-- Purpose  : نظام محادثات تفاعلي بين أولياء الأمور والإدارة
-- Strategy : لا يعتمد على وجود جداول معينة — يتحقق من كل شيء قبل التنفيذ
-- ==========================================================================

SET search_path TO public;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. إنشاء الجدولين بدون أي FK (بتتضاف لاحقاً بشكل conditional)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.conversations (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id            UUID        NOT NULL,
    parent_id            UUID        NOT NULL,
    student_id           UUID,
    subject              TEXT        NOT NULL DEFAULT 'استفسار عام',
    status               TEXT        NOT NULL DEFAULT 'open'
                         CHECK (status IN ('open','in_progress','resolved','closed')),
    priority             TEXT        NOT NULL DEFAULT 'normal'
                         CHECK (priority IN ('low','normal','high','urgent')),
    last_message_at      TIMESTAMPTZ DEFAULT NOW(),
    last_message_preview TEXT,
    unread_by_admin      INT         NOT NULL DEFAULT 0,
    unread_by_parent     INT         NOT NULL DEFAULT 0,
    messages_count       INT         NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conversation_messages (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id  UUID        NOT NULL,
    sender_id        UUID        NOT NULL,
    sender_role      TEXT        NOT NULL CHECK (sender_role IN ('parent','admin','teacher')),
    content          TEXT        NOT NULL,
    is_read          BOOLEAN     NOT NULL DEFAULT false,
    deleted_by_admin BOOLEAN     NOT NULL DEFAULT false,
    deleted_at       TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. FK Constraints — كل واحدة بتتضاف بس لو الجدول المرجعي موجود
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
    t_exists BOOLEAN;
BEGIN

    -- ── conversations → schools ──────────────────────────────────────────
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'schools'
    ) INTO t_exists;

    IF t_exists THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_schema = 'public'
              AND table_name    = 'conversations'
              AND constraint_name = 'conversations_school_id_fkey'
        ) THEN
            EXECUTE 'ALTER TABLE public.conversations
                     ADD CONSTRAINT conversations_school_id_fkey
                     FOREIGN KEY (school_id) REFERENCES public.schools(id)
                     ON DELETE CASCADE';
        END IF;
    END IF;

    -- ── conversations → profiles ─────────────────────────────────────────
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'profiles'
    ) INTO t_exists;

    IF t_exists THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_schema = 'public'
              AND table_name    = 'conversations'
              AND constraint_name = 'conversations_parent_id_fkey'
        ) THEN
            EXECUTE 'ALTER TABLE public.conversations
                     ADD CONSTRAINT conversations_parent_id_fkey
                     FOREIGN KEY (parent_id) REFERENCES public.profiles(id)
                     ON DELETE CASCADE';
        END IF;
    END IF;

    -- ── conversations → students ─────────────────────────────────────────
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'students'
    ) INTO t_exists;

    IF t_exists THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_schema = 'public'
              AND table_name    = 'conversations'
              AND constraint_name = 'conversations_student_id_fkey'
        ) THEN
            EXECUTE 'ALTER TABLE public.conversations
                     ADD CONSTRAINT conversations_student_id_fkey
                     FOREIGN KEY (student_id) REFERENCES public.students(id)
                     ON DELETE SET NULL';
        END IF;
    END IF;

    -- ── conversation_messages → conversations ────────────────────────────
    -- الجدول موجود بالتأكيد (أنشأناه فوق)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name    = 'conversation_messages'
          AND constraint_name = 'conversation_messages_conversation_id_fkey'
    ) THEN
        EXECUTE 'ALTER TABLE public.conversation_messages
                 ADD CONSTRAINT conversation_messages_conversation_id_fkey
                 FOREIGN KEY (conversation_id) REFERENCES public.conversations(id)
                 ON DELETE CASCADE';
    END IF;

    -- ── conversation_messages → profiles ─────────────────────────────────
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'profiles'
    ) INTO t_exists;

    IF t_exists THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_schema = 'public'
              AND table_name    = 'conversation_messages'
              AND constraint_name = 'conversation_messages_sender_id_fkey'
        ) THEN
            EXECUTE 'ALTER TABLE public.conversation_messages
                     ADD CONSTRAINT conversation_messages_sender_id_fkey
                     FOREIGN KEY (sender_id) REFERENCES public.profiles(id)
                     ON DELETE CASCADE';
        END IF;
    END IF;

END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Indexes
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_conversations_school_id ON public.conversations(school_id);
CREATE INDEX IF NOT EXISTS idx_conversations_parent_id ON public.conversations(parent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status    ON public.conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg  ON public.conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_messages_conv_id   ON public.conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_messages_sender    ON public.conversation_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_conv_messages_created   ON public.conversation_messages(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. RLS
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.conversations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

-- حذف القديمة بشكل آمن
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('conversations', 'conversation_messages')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                       r.policyname, r.tablename);
    END LOOP;
END $$;

-- ── conversations policies ───────────────────────────────────────────────

-- ولي الأمر: يرى ويُنشئ محادثاته
CREATE POLICY "conv_parent_select" ON public.conversations
    FOR SELECT USING (auth.uid() = parent_id);

CREATE POLICY "conv_parent_insert" ON public.conversations
    FOR INSERT WITH CHECK (auth.uid() = parent_id);

CREATE POLICY "conv_parent_update" ON public.conversations
    FOR UPDATE USING (auth.uid() = parent_id);

-- الأدمن: يرى ويعدّل ويحذف محادثات مدرسته
-- ملاحظة: لا نعتمد على user_roles هنا مباشرةً في الـ policy
-- بدلاً من ذلك نستخدم دالة موجودة أو نتحقق ببساطة
CREATE POLICY "conv_admin_select" ON public.conversations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id   = auth.uid()
              AND ur.role       = 'admin'
              AND ur.school_id  = conversations.school_id
        )
    );

CREATE POLICY "conv_admin_update" ON public.conversations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id   = auth.uid()
              AND ur.role       = 'admin'
              AND ur.school_id  = conversations.school_id
        )
    );

CREATE POLICY "conv_admin_delete" ON public.conversations
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id   = auth.uid()
              AND ur.role       = 'admin'
              AND ur.school_id  = conversations.school_id
        )
    );

-- Super Admin
CREATE POLICY "conv_super_admin" ON public.conversations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND is_super_admin = true
        )
    );

-- ── conversation_messages policies ──────────────────────────────────────

CREATE POLICY "cmsg_parent_select" ON public.conversation_messages
    FOR SELECT USING (
        deleted_by_admin = false
        AND EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id AND c.parent_id = auth.uid()
        )
    );

CREATE POLICY "cmsg_parent_insert" ON public.conversation_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id
        AND EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id AND c.parent_id = auth.uid()
        )
    );

CREATE POLICY "cmsg_admin_select" ON public.conversation_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            JOIN public.user_roles ur ON ur.school_id = c.school_id
            WHERE c.id         = conversation_id
              AND ur.user_id   = auth.uid()
              AND ur.role       = 'admin'
        )
    );

CREATE POLICY "cmsg_admin_insert" ON public.conversation_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id
        AND EXISTS (
            SELECT 1 FROM public.conversations c
            JOIN public.user_roles ur ON ur.school_id = c.school_id
            WHERE c.id        = conversation_id
              AND ur.user_id  = auth.uid()
              AND ur.role      IN ('admin','teacher')
        )
    );

CREATE POLICY "cmsg_admin_update" ON public.conversation_messages
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            JOIN public.user_roles ur ON ur.school_id = c.school_id
            WHERE c.id        = conversation_id
              AND ur.user_id  = auth.uid()
              AND ur.role      = 'admin'
        )
    );

CREATE POLICY "cmsg_super_admin" ON public.conversation_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND is_super_admin = true
        )
    );

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Trigger: تحديث المحادثة عند رسالة جديدة
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_conversation_on_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.conversations SET
        last_message_at      = NEW.created_at,
        last_message_preview = LEFT(NEW.content, 100),
        messages_count       = messages_count + 1,
        updated_at           = NOW(),
        unread_by_admin  = CASE
            WHEN NEW.sender_role = 'parent'
            THEN unread_by_admin + 1
            ELSE unread_by_admin
        END,
        unread_by_parent = CASE
            WHEN NEW.sender_role IN ('admin','teacher')
            THEN unread_by_parent + 1
            ELSE unread_by_parent
        END,
        status = CASE
            WHEN status = 'closed'  AND NEW.sender_role = 'parent'             THEN 'open'
            WHEN status = 'open'    AND NEW.sender_role IN ('admin','teacher')  THEN 'in_progress'
            ELSE status
        END
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_update_conversation_on_message ON public.conversation_messages;
CREATE TRIGGER tr_update_conversation_on_message
    AFTER INSERT ON public.conversation_messages
    FOR EACH ROW EXECUTE FUNCTION public.update_conversation_on_new_message();

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Trigger: إشعارات (بتعمل مع نظام notifications الموجود لو موجود)
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
    -- هل جدول notifications موجود؟
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'notifications'
    ) INTO v_notif_exists;

    IF NOT v_notif_exists THEN
        RETURN NEW;
    END IF;

    SELECT * INTO v_conv FROM public.conversations WHERE id = NEW.conversation_id;
    IF NOT FOUND THEN RETURN NEW; END IF;

    -- هل جدول profiles موجود؟
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'profiles'
    ) THEN
        SELECT full_name INTO v_sender_name
        FROM public.profiles WHERE id = NEW.sender_id;
    END IF;

    IF NEW.sender_role = 'parent' THEN
        -- إشعار لكل أدمن في المدرسة
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

    ELSIF NEW.sender_role IN ('admin','teacher') THEN
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Realtime
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_messages;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. Grants
-- ═══════════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations         TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_messages TO service_role;

REVOKE EXECUTE ON FUNCTION public.update_conversation_on_new_message()  FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_new_conversation_message()  FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.update_conversation_on_new_message()  TO service_role;
GRANT  EXECUTE ON FUNCTION public.notify_on_new_conversation_message()  TO service_role;

NOTIFY pgrst, 'reload schema';
