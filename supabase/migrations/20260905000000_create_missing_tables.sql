-- ==========================================================================
-- Migration: 20260905000000_create_missing_tables.sql
-- Purpose  : إنشاء الجداول المفقودة بشكل idempotent
-- Context  : يُشغَّل على بيئة تحتوي فقط على:
--            attendance, classes, complaints, fee_payments, fees, grades,
--            messages, notifications, profiles, school_orders, schools,
--            student_parents, students, user_roles
-- ==========================================================================

SET search_path TO public;

-- ==========================================================================
-- 1. CURRICULUMS
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.curriculums (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id  UUID        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name       TEXT        NOT NULL,
    status     TEXT        NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.curriculums ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "curriculums_access" ON public.curriculums;
CREATE POLICY "curriculums_access"
    ON public.curriculums FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = (SELECT auth.uid()) AND is_super_admin = true
        )
        OR school_id = (
            SELECT ur.school_id FROM public.user_roles ur
            WHERE ur.user_id = (SELECT auth.uid()) LIMIT 1
        )
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculums TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculums TO service_role;

-- ==========================================================================
-- 2. CURRICULUM_SUBJECTS
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.curriculum_subjects (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_id UUID        NOT NULL REFERENCES public.curriculums(id) ON DELETE CASCADE,
    subject_name  TEXT        NOT NULL,
    description   TEXT,
    content       TEXT,
    term          TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.curriculum_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "curriculum_subjects_access" ON public.curriculum_subjects;
CREATE POLICY "curriculum_subjects_access"
    ON public.curriculum_subjects FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = (SELECT auth.uid()) AND is_super_admin = true
        )
        OR EXISTS (
            SELECT 1 FROM public.curriculums c
            WHERE c.id = curriculum_id
              AND c.school_id = (
                  SELECT ur.school_id FROM public.user_roles ur
                  WHERE ur.user_id = (SELECT auth.uid()) LIMIT 1
              )
        )
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculum_subjects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculum_subjects TO service_role;

-- ==========================================================================
-- 3. إضافة curriculum_id لجدول classes (إن لم تكن موجودة)
-- ==========================================================================

ALTER TABLE public.classes
    ADD COLUMN IF NOT EXISTS curriculum_id UUID
    REFERENCES public.curriculums(id) ON DELETE SET NULL;

-- ==========================================================================
-- 4. EXAM_TEMPLATES
--    الجدول قد يكون موجوداً بهيكل مختلف (migration 20260404300000).
--    نستخدم IF NOT EXISTS ونضيف الأعمدة الجديدة بـ ADD COLUMN IF NOT EXISTS.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.exam_templates (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id        UUID        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    class_id         UUID        REFERENCES public.classes(id) ON DELETE SET NULL,
    title            TEXT        NOT NULL,
    subject          TEXT        NOT NULL,
    term             TEXT        NOT NULL,
    score_type       TEXT        NOT NULL DEFAULT 'numeric'
                     CHECK (score_type IN ('numeric', 'letter', 'percentage')),
    expected_results JSONB       DEFAULT '[]'::jsonb,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- أعمدة قد تكون مفقودة في نسخ قديمة من الجدول
ALTER TABLE public.exam_templates ADD COLUMN IF NOT EXISTS title            TEXT;
ALTER TABLE public.exam_templates ADD COLUMN IF NOT EXISTS score_type       TEXT        DEFAULT 'numeric';
ALTER TABLE public.exam_templates ADD COLUMN IF NOT EXISTS expected_results JSONB       DEFAULT '[]'::jsonb;
ALTER TABLE public.exam_templates ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.exam_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "isolation_policy"       ON public.exam_templates;
DROP POLICY IF EXISTS "exam_templates_access"  ON public.exam_templates;
CREATE POLICY "exam_templates_access"
    ON public.exam_templates FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = (SELECT auth.uid()) AND is_super_admin = true
        )
        OR school_id = (
            SELECT ur.school_id FROM public.user_roles ur
            WHERE ur.user_id = (SELECT auth.uid()) LIMIT 1
        )
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_templates TO service_role;

-- ==========================================================================
-- 5. PUSH_SUBSCRIPTIONS
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    school_id            UUID        REFERENCES public.schools(id) ON DELETE CASCADE,
    subscription         JSONB       NOT NULL,
    user_agent           TEXT,
    failure_count        INTEGER     NOT NULL DEFAULT 0,
    last_failure_at      TIMESTAMPTZ,
    last_failure_reason  TEXT,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- أعمدة قد تكون مفقودة في نسخ قديمة
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS school_id           UUID        REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS user_agent          TEXT;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS failure_count       INTEGER     NOT NULL DEFAULT 0;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS last_failure_at     TIMESTAMPTZ;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS last_failure_reason TEXT;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_idx
    ON public.push_subscriptions ((subscription->>'endpoint'));

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can read their own push subscriptions"   ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update their own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete their own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_own"                        ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_own"
    ON public.push_subscriptions FOR ALL TO authenticated
    USING     (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO service_role;

-- ==========================================================================
-- 6. TEACHER_ATTENDANCE
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.teacher_attendance (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id  UUID        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    teacher_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date       DATE        NOT NULL DEFAULT CURRENT_DATE,
    status     TEXT        NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
    notes      TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (teacher_id, date, school_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_attendance_school   ON public.teacher_attendance(school_id);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_teacher  ON public.teacher_attendance(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_date     ON public.teacher_attendance(date);

ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access"                ON public.teacher_attendance;
DROP POLICY IF EXISTS "Teachers view own"                 ON public.teacher_attendance;
DROP POLICY IF EXISTS "teacher_attendance_admin_all"      ON public.teacher_attendance;
DROP POLICY IF EXISTS "teacher_attendance_teacher_select" ON public.teacher_attendance;

CREATE POLICY "teacher_attendance_admin_all"
    ON public.teacher_attendance FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id        = (SELECT auth.uid())
              AND user_roles.role            = 'admin'
              AND user_roles.approval_status = 'approved'
              AND user_roles.school_id       = teacher_attendance.school_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id        = (SELECT auth.uid())
              AND user_roles.role            = 'admin'
              AND user_roles.approval_status = 'approved'
              AND user_roles.school_id       = teacher_attendance.school_id
        )
    );

CREATE POLICY "teacher_attendance_teacher_select"
    ON public.teacher_attendance FOR SELECT
    USING (teacher_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_attendance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_attendance TO service_role;

-- ==========================================================================
-- 7. CONVERSATIONS + CONVERSATION_MESSAGES
-- ==========================================================================

-- ── 7.1 إنشاء الجدولين بدون FK أولاً ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.conversations (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id            UUID        NOT NULL,
    parent_id            UUID        NOT NULL,
    student_id           UUID,
    subject              TEXT        NOT NULL DEFAULT 'استفسار عام',
    status               TEXT        NOT NULL DEFAULT 'open'
                         CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority             TEXT        NOT NULL DEFAULT 'normal'
                         CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
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
    sender_role      TEXT        NOT NULL CHECK (sender_role IN ('parent', 'admin', 'teacher')),
    content          TEXT        NOT NULL,
    is_read          BOOLEAN     NOT NULL DEFAULT false,
    deleted_by_admin BOOLEAN     NOT NULL DEFAULT false,
    deleted_at       TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7.2 FK Constraints (conditional) ─────────────────────────────────────

DO $$
BEGIN
    -- conversations → schools
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public' AND table_name = 'conversations'
          AND constraint_name = 'conversations_school_id_fkey'
    ) THEN
        EXECUTE 'ALTER TABLE public.conversations
                 ADD CONSTRAINT conversations_school_id_fkey
                 FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE';
    END IF;

    -- conversations → profiles (parent_id)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public' AND table_name = 'conversations'
          AND constraint_name = 'conversations_parent_id_fkey'
    ) THEN
        EXECUTE 'ALTER TABLE public.conversations
                 ADD CONSTRAINT conversations_parent_id_fkey
                 FOREIGN KEY (parent_id) REFERENCES public.profiles(id) ON DELETE CASCADE';
    END IF;

    -- conversations → students (student_id nullable)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public' AND table_name = 'conversations'
          AND constraint_name = 'conversations_student_id_fkey'
    ) THEN
        EXECUTE 'ALTER TABLE public.conversations
                 ADD CONSTRAINT conversations_student_id_fkey
                 FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL';
    END IF;

    -- conversation_messages → conversations
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public' AND table_name = 'conversation_messages'
          AND constraint_name = 'conversation_messages_conversation_id_fkey'
    ) THEN
        EXECUTE 'ALTER TABLE public.conversation_messages
                 ADD CONSTRAINT conversation_messages_conversation_id_fkey
                 FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE';
    END IF;

    -- conversation_messages → profiles (sender_id)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public' AND table_name = 'conversation_messages'
          AND constraint_name = 'conversation_messages_sender_id_fkey'
    ) THEN
        EXECUTE 'ALTER TABLE public.conversation_messages
                 ADD CONSTRAINT conversation_messages_sender_id_fkey
                 FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE';
    END IF;
END $$;

-- ── 7.3 Indexes ───────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_conversations_school_id ON public.conversations(school_id);
CREATE INDEX IF NOT EXISTS idx_conversations_parent_id ON public.conversations(parent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status    ON public.conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg  ON public.conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_messages_conv_id   ON public.conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_messages_sender    ON public.conversation_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_conv_messages_created   ON public.conversation_messages(created_at DESC);

-- ── 7.4 RLS ───────────────────────────────────────────────────────────────

ALTER TABLE public.conversations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

-- حذف policies قديمة
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT policyname, tablename FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('conversations', 'conversation_messages')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- conversations
CREATE POLICY "conversations_select"
    ON public.conversations FOR SELECT
    USING (
        parent_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id  = (SELECT auth.uid())
              AND ur.role      = 'admin'
              AND ur.school_id = conversations.school_id
        )
        OR EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = (SELECT auth.uid()) AND is_super_admin = true
        )
    );

CREATE POLICY "conversations_insert"
    ON public.conversations FOR INSERT
    WITH CHECK (
        parent_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = (SELECT auth.uid()) AND is_super_admin = true
        )
    );

CREATE POLICY "conversations_update"
    ON public.conversations FOR UPDATE
    USING (
        parent_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id  = (SELECT auth.uid())
              AND ur.role      = 'admin'
              AND ur.school_id = conversations.school_id
        )
        OR EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = (SELECT auth.uid()) AND is_super_admin = true
        )
    );

CREATE POLICY "conversations_delete"
    ON public.conversations FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id  = (SELECT auth.uid())
              AND ur.role      = 'admin'
              AND ur.school_id = conversations.school_id
        )
        OR EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = (SELECT auth.uid()) AND is_super_admin = true
        )
    );

-- conversation_messages
CREATE POLICY "conv_messages_select"
    ON public.conversation_messages FOR SELECT
    USING (
        (
            deleted_by_admin = false
            AND EXISTS (
                SELECT 1 FROM public.conversations c
                WHERE c.id = conversation_id AND c.parent_id = (SELECT auth.uid())
            )
        )
        OR EXISTS (
            SELECT 1 FROM public.conversations c
            JOIN public.user_roles ur ON ur.school_id = c.school_id
            WHERE c.id       = conversation_id
              AND ur.user_id = (SELECT auth.uid())
              AND ur.role     = 'admin'
        )
        OR EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = (SELECT auth.uid()) AND is_super_admin = true
        )
    );

CREATE POLICY "conv_messages_insert"
    ON public.conversation_messages FOR INSERT
    WITH CHECK (
        sender_id = (SELECT auth.uid())
        AND (
            EXISTS (
                SELECT 1 FROM public.conversations c
                WHERE c.id = conversation_id AND c.parent_id = (SELECT auth.uid())
            )
            OR EXISTS (
                SELECT 1 FROM public.conversations c
                JOIN public.user_roles ur ON ur.school_id = c.school_id
                WHERE c.id       = conversation_id
                  AND ur.user_id = (SELECT auth.uid())
                  AND ur.role     IN ('admin', 'teacher')
            )
            OR EXISTS (
                SELECT 1 FROM public.user_roles
                WHERE user_id = (SELECT auth.uid()) AND is_super_admin = true
            )
        )
    );

CREATE POLICY "conv_messages_update"
    ON public.conversation_messages FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            JOIN public.user_roles ur ON ur.school_id = c.school_id
            WHERE c.id       = conversation_id
              AND ur.user_id = (SELECT auth.uid())
              AND ur.role     = 'admin'
        )
        OR EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = (SELECT auth.uid()) AND is_super_admin = true
        )
    );

-- ── 7.5 Grants ────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations         TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_messages TO service_role;

-- ── 7.6 Trigger: update conversation on new message ───────────────────────

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
            WHEN NEW.sender_role IN ('admin', 'teacher')
            THEN unread_by_parent + 1
            ELSE unread_by_parent
        END,
        status = CASE
            WHEN status = 'closed'  AND NEW.sender_role = 'parent'             THEN 'open'
            WHEN status = 'open'    AND NEW.sender_role IN ('admin', 'teacher') THEN 'in_progress'
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

REVOKE EXECUTE ON FUNCTION public.update_conversation_on_new_message() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.update_conversation_on_new_message() TO service_role;

-- ── 7.7 Realtime ──────────────────────────────────────────────────────────

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

-- ==========================================================================
-- 8. ELECTRONIC_EXAMS + EXAM_QUESTIONS + EXAM_ATTEMPTS
--    + CLASS_CHAT_ROOMS + CLASS_CHAT_MESSAGES
-- ==========================================================================

-- ── 8.1 الجداول ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.electronic_exams (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id        UUID        NOT NULL REFERENCES public.schools(id)  ON DELETE CASCADE,
    class_id         UUID        NOT NULL REFERENCES public.classes(id)  ON DELETE CASCADE,
    teacher_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title            TEXT        NOT NULL,
    subject          TEXT        NOT NULL,
    duration_minutes INTEGER     NOT NULL CHECK (duration_minutes >= 1 AND duration_minutes <= 180),
    instructions     TEXT,
    status           TEXT        NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'published', 'archived')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.exam_questions (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id       UUID        NOT NULL REFERENCES public.electronic_exams(id) ON DELETE CASCADE,
    school_id     UUID        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    question_type TEXT        NOT NULL CHECK (question_type IN ('true_false', 'multiple_choice', 'fill_blank')),
    question_text TEXT        NOT NULL,
    options       JSONB,
    correct_answer TEXT       NOT NULL,
    order_index   INTEGER     NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.exam_attempts (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id            UUID        NOT NULL REFERENCES public.electronic_exams(id) ON DELETE CASCADE,
    student_id         UUID        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    parent_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    answers            JSONB       NOT NULL DEFAULT '{}'::jsonb,
    score              INTEGER     NOT NULL DEFAULT 0 CHECK (score >= 0),
    total_score        INTEGER     NOT NULL DEFAULT 0 CHECK (total_score >= 0),
    time_spent_seconds INTEGER     NOT NULL DEFAULT 0 CHECK (time_spent_seconds >= 0),
    started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at       TIMESTAMPTZ,
    CONSTRAINT exam_attempts_score_lte_total    CHECK (score <= total_score),
    CONSTRAINT exam_attempts_unique_student     UNIQUE (exam_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.class_chat_rooms (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id  UUID        NOT NULL REFERENCES public.schools(id)  ON DELETE CASCADE,
    class_id   UUID        NOT NULL REFERENCES public.classes(id)  ON DELETE CASCADE,
    name       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT class_chat_rooms_unique_class UNIQUE (school_id, class_id)
);

CREATE TABLE IF NOT EXISTS public.class_chat_messages (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id     UUID        NOT NULL REFERENCES public.class_chat_rooms(id) ON DELETE CASCADE,
    sender_id   UUID        NOT NULL,
    sender_name TEXT,
    content     TEXT        NOT NULL CHECK (char_length(content) <= 500),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 8.2 Indexes ───────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_electronic_exams_school     ON public.electronic_exams(school_id);
CREATE INDEX IF NOT EXISTS idx_electronic_exams_class      ON public.electronic_exams(class_id);
CREATE INDEX IF NOT EXISTS idx_electronic_exams_status     ON public.electronic_exams(status);
CREATE INDEX IF NOT EXISTS idx_electronic_exams_created    ON public.electronic_exams(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_exam_questions_exam_id      ON public.exam_questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_questions_school_id    ON public.exam_questions(school_id);
CREATE INDEX IF NOT EXISTS idx_exam_questions_order        ON public.exam_questions(exam_id, order_index);

CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_id       ON public.exam_attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student_id    ON public.exam_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_parent_id     ON public.exam_attempts(parent_id);

CREATE INDEX IF NOT EXISTS idx_class_chat_rooms_school     ON public.class_chat_rooms(school_id);
CREATE INDEX IF NOT EXISTS idx_class_chat_rooms_class      ON public.class_chat_rooms(class_id);

CREATE INDEX IF NOT EXISTS idx_class_chat_messages_room    ON public.class_chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_class_chat_messages_sender  ON public.class_chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_class_chat_messages_created ON public.class_chat_messages(created_at ASC);

-- ── 8.3 RLS ───────────────────────────────────────────────────────────────

ALTER TABLE public.electronic_exams    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_questions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_chat_rooms    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_chat_messages ENABLE ROW LEVEL SECURITY;

-- حذف policies قديمة بشكل آمن
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT policyname, tablename FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN (
            'electronic_exams', 'exam_questions', 'exam_attempts',
            'class_chat_rooms', 'class_chat_messages'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- electronic_exams
CREATE POLICY "electronic_exams_school_access"
    ON public.electronic_exams FOR ALL TO authenticated
    USING (
        school_id = (
            SELECT ur.school_id FROM public.user_roles ur
            WHERE ur.user_id = (SELECT auth.uid()) LIMIT 1
        )
        OR EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = (SELECT auth.uid()) AND is_super_admin = true
        )
    );

-- exam_questions
CREATE POLICY "exam_questions_school_access"
    ON public.exam_questions FOR ALL TO authenticated
    USING (
        school_id = (
            SELECT ur.school_id FROM public.user_roles ur
            WHERE ur.user_id = (SELECT auth.uid()) LIMIT 1
        )
        OR EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = (SELECT auth.uid()) AND is_super_admin = true
        )
    );

-- exam_attempts
CREATE POLICY "exam_attempts_school_access"
    ON public.exam_attempts FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.electronic_exams ee
            WHERE ee.id = exam_attempts.exam_id
              AND ee.school_id = (
                  SELECT ur.school_id FROM public.user_roles ur
                  WHERE ur.user_id = (SELECT auth.uid()) LIMIT 1
              )
        )
        OR parent_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = (SELECT auth.uid()) AND is_super_admin = true
        )
    );

-- class_chat_rooms
CREATE POLICY "class_chat_rooms_school_access"
    ON public.class_chat_rooms FOR ALL TO authenticated
    USING (
        school_id = (
            SELECT ur.school_id FROM public.user_roles ur
            WHERE ur.user_id = (SELECT auth.uid()) LIMIT 1
        )
        OR EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = (SELECT auth.uid()) AND is_super_admin = true
        )
    );

-- class_chat_messages
CREATE POLICY "class_chat_messages_school_access"
    ON public.class_chat_messages FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.class_chat_rooms ccr
            WHERE ccr.id = class_chat_messages.room_id
              AND ccr.school_id = (
                  SELECT ur.school_id FROM public.user_roles ur
                  WHERE ur.user_id = (SELECT auth.uid()) LIMIT 1
              )
        )
        OR EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = (SELECT auth.uid()) AND is_super_admin = true
        )
    );

-- ── 8.4 Grants ────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.electronic_exams    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_questions       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_attempts        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_chat_rooms     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_chat_messages  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.electronic_exams    TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_questions       TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_attempts        TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_chat_rooms     TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_chat_messages  TO service_role;

-- ── 8.5 Trigger: updated_at for electronic_exams ─────────────────────────

CREATE OR REPLACE FUNCTION public.update_electronic_exam_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_electronic_exams_updated_at ON public.electronic_exams;
CREATE TRIGGER tr_electronic_exams_updated_at
    BEFORE UPDATE ON public.electronic_exams
    FOR EACH ROW EXECUTE FUNCTION public.update_electronic_exam_updated_at();

REVOKE EXECUTE ON FUNCTION public.update_electronic_exam_updated_at() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.update_electronic_exam_updated_at() TO service_role;

-- ── 8.6 Realtime ──────────────────────────────────────────────────────────

ALTER TABLE public.class_chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.electronic_exams    REPLICA IDENTITY FULL;
ALTER TABLE public.exam_attempts       REPLICA IDENTITY FULL;

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.electronic_exams;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.exam_attempts;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.class_chat_rooms;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.class_chat_messages;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
END $$;

-- ==========================================================================
-- ANALYZE
-- ==========================================================================

DO $$
DECLARE
    tbl  TEXT;
    tbls TEXT[] := ARRAY[
        'curriculums', 'curriculum_subjects', 'exam_templates',
        'push_subscriptions', 'teacher_attendance',
        'conversations', 'conversation_messages',
        'electronic_exams', 'exam_questions', 'exam_attempts',
        'class_chat_rooms', 'class_chat_messages'
    ];
BEGIN
    FOREACH tbl IN ARRAY tbls LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = tbl
        ) THEN
            EXECUTE format('ANALYZE public.%I', tbl);
        END IF;
    END LOOP;
END $$;

-- ==========================================================================
NOTIFY pgrst, 'reload schema';
-- ==========================================================================
