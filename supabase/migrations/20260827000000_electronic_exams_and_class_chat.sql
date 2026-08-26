-- ==========================================================================
-- Migration: 20260827000000_electronic_exams_and_class_chat.sql
-- Purpose  : نظام الاختبارات الإلكترونية + دردشة أولياء الأمور في الفصول
-- ==========================================================================

SET search_path TO public;

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 1: ELECTRONIC EXAMS SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════

-- 1.1 جدول الاختبارات الإلكترونية
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

-- 1.2 جدول أسئلة الاختبارات
CREATE TABLE IF NOT EXISTS public.exam_questions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id         UUID        NOT NULL REFERENCES public.electronic_exams(id) ON DELETE CASCADE,
    school_id       UUID        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    question_type   TEXT        NOT NULL CHECK (question_type IN ('true_false', 'multiple_choice', 'fill_blank')),
    question_text   TEXT        NOT NULL,
    options         JSONB,
    correct_answer  TEXT        NOT NULL,
    order_index     INTEGER     NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.3 جدول محاولات الاختبار
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
    -- درجة لا يمكن أن تتجاوز الدرجة الكلية
    CONSTRAINT exam_attempts_score_lte_total CHECK (score <= total_score),
    -- طالب واحد لا يمكنه إجراء نفس الاختبار مرتين
    CONSTRAINT exam_attempts_unique_student UNIQUE (exam_id, student_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 2: CLASS CHAT SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════

-- 2.1 جدول غرف الدردشة للفصول
CREATE TABLE IF NOT EXISTS public.class_chat_rooms (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id  UUID        NOT NULL REFERENCES public.schools(id)  ON DELETE CASCADE,
    class_id   UUID        NOT NULL REFERENCES public.classes(id)  ON DELETE CASCADE,
    name       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT class_chat_rooms_unique_class UNIQUE (school_id, class_id)
);

-- 2.2 جدول رسائل الدردشة
CREATE TABLE IF NOT EXISTS public.class_chat_messages (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id    UUID        NOT NULL REFERENCES public.class_chat_rooms(id) ON DELETE CASCADE,
    sender_id  UUID        NOT NULL,
    sender_name TEXT,
    content    TEXT        NOT NULL CHECK (char_length(content) <= 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 3: INDEXES
-- ═══════════════════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 4: ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.electronic_exams    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_questions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_chat_rooms    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_chat_messages ENABLE ROW LEVEL SECURITY;

-- حذف policies القديمة لو موجودة
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

-- ─── electronic_exams ───────────────────────────────────────────────────────

-- Admin/Teacher: كل العمليات على اختبارات مدرستهم
CREATE POLICY "elexam_admin_all" ON public.electronic_exams
    FOR ALL USING (
        school_id = public.get_my_school_id()
        AND public.get_my_role() IN ('admin', 'teacher')
    );

-- Parent: يرى الاختبارات المنشورة للفصول التي فيها أبناؤه
CREATE POLICY "elexam_parent_select" ON public.electronic_exams
    FOR SELECT USING (
        status = 'published'
        AND school_id = public.get_my_school_id()
        AND public.get_my_role() = 'parent'
        AND EXISTS (
            SELECT 1 FROM public.student_parents sp
            JOIN public.students s ON s.id = sp.student_id
            WHERE sp.parent_id = auth.uid()
              AND s.class_id   = electronic_exams.class_id
        )
    );

-- Super Admin
CREATE POLICY "elexam_super_admin" ON public.electronic_exams
    FOR ALL USING (public.is_super_admin());

-- ─── exam_questions ──────────────────────────────────────────────────────────

CREATE POLICY "examq_admin_all" ON public.exam_questions
    FOR ALL USING (
        school_id = public.get_my_school_id()
        AND public.get_my_role() IN ('admin', 'teacher')
    );

CREATE POLICY "examq_parent_select" ON public.exam_questions
    FOR SELECT USING (
        school_id = public.get_my_school_id()
        AND public.get_my_role() = 'parent'
        AND EXISTS (
            SELECT 1 FROM public.electronic_exams ee
            JOIN public.student_parents sp ON sp.parent_id = auth.uid()
            JOIN public.students s ON s.id = sp.student_id AND s.class_id = ee.class_id
            WHERE ee.id = exam_questions.exam_id
              AND ee.status = 'published'
        )
    );

CREATE POLICY "examq_super_admin" ON public.exam_questions
    FOR ALL USING (public.is_super_admin());

-- ─── exam_attempts ──────────────────────────────────────────────────────────

-- Admin/Teacher: يرى محاولات مدرستهم
CREATE POLICY "examatt_admin_select" ON public.exam_attempts
    FOR SELECT USING (
        public.get_my_role() IN ('admin', 'teacher')
        AND EXISTS (
            SELECT 1 FROM public.electronic_exams ee
            WHERE ee.id = exam_attempts.exam_id
              AND ee.school_id = public.get_my_school_id()
        )
    );

-- Parent: يُنشئ ويرى محاولاته هو فقط
CREATE POLICY "examatt_parent_insert" ON public.exam_attempts
    FOR INSERT WITH CHECK (
        auth.uid() = parent_id
        AND public.get_my_role() = 'parent'
        -- يتحقق أن الطالب من أبناء ولي الأمر
        AND EXISTS (
            SELECT 1 FROM public.student_parents sp
            WHERE sp.parent_id  = auth.uid()
              AND sp.student_id = exam_attempts.student_id
        )
    );

CREATE POLICY "examatt_parent_select" ON public.exam_attempts
    FOR SELECT USING (
        auth.uid() = parent_id
        AND public.get_my_role() = 'parent'
    );

CREATE POLICY "examatt_super_admin" ON public.exam_attempts
    FOR ALL USING (public.is_super_admin());

-- ─── class_chat_rooms ────────────────────────────────────────────────────────

-- Admin/Teacher: كل العمليات
CREATE POLICY "ccroom_admin_all" ON public.class_chat_rooms
    FOR ALL USING (
        school_id = public.get_my_school_id()
        AND public.get_my_role() IN ('admin', 'teacher')
    );

-- Parent: يرى غرف الفصول التي فيها أبناؤه فقط
CREATE POLICY "ccroom_parent_select" ON public.class_chat_rooms
    FOR SELECT USING (
        school_id = public.get_my_school_id()
        AND public.get_my_role() = 'parent'
        AND EXISTS (
            SELECT 1 FROM public.student_parents sp
            JOIN public.students s ON s.id = sp.student_id
            WHERE sp.parent_id = auth.uid()
              AND s.class_id   = class_chat_rooms.class_id
        )
    );

-- Parent: ينشئ غرفة (idempotent via INSERT ... ON CONFLICT DO NOTHING)
CREATE POLICY "ccroom_parent_insert" ON public.class_chat_rooms
    FOR INSERT WITH CHECK (
        school_id = public.get_my_school_id()
        AND public.get_my_role() = 'parent'
        AND EXISTS (
            SELECT 1 FROM public.student_parents sp
            JOIN public.students s ON s.id = sp.student_id
            WHERE sp.parent_id = auth.uid()
              AND s.class_id   = class_chat_rooms.class_id
        )
    );

CREATE POLICY "ccroom_super_admin" ON public.class_chat_rooms
    FOR ALL USING (public.is_super_admin());

-- ─── class_chat_messages ─────────────────────────────────────────────────────

-- Parent: يرى رسائل غرف الفصول التي له أبناء فيها
CREATE POLICY "ccmsg_parent_select" ON public.class_chat_messages
    FOR SELECT USING (
        public.get_my_role() = 'parent'
        AND EXISTS (
            SELECT 1 FROM public.class_chat_rooms ccr
            JOIN public.student_parents sp ON sp.parent_id = auth.uid()
            JOIN public.students s ON s.id = sp.student_id AND s.class_id = ccr.class_id
            WHERE ccr.id = class_chat_messages.room_id
              AND ccr.school_id = public.get_my_school_id()
        )
    );

-- Parent: يُرسل رسائل للغرف التي له أبناء فيها
CREATE POLICY "ccmsg_parent_insert" ON public.class_chat_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id
        AND public.get_my_role() = 'parent'
        AND EXISTS (
            SELECT 1 FROM public.class_chat_rooms ccr
            JOIN public.student_parents sp ON sp.parent_id = auth.uid()
            JOIN public.students s ON s.id = sp.student_id AND s.class_id = ccr.class_id
            WHERE ccr.id = class_chat_messages.room_id
              AND ccr.school_id = public.get_my_school_id()
        )
    );

-- Admin/Teacher: يرى ويرسل في كل غرف مدرستهم
CREATE POLICY "ccmsg_admin_select" ON public.class_chat_messages
    FOR SELECT USING (
        public.get_my_role() IN ('admin', 'teacher')
        AND EXISTS (
            SELECT 1 FROM public.class_chat_rooms ccr
            WHERE ccr.id = class_chat_messages.room_id
              AND ccr.school_id = public.get_my_school_id()
        )
    );

CREATE POLICY "ccmsg_admin_insert" ON public.class_chat_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id
        AND public.get_my_role() IN ('admin', 'teacher')
        AND EXISTS (
            SELECT 1 FROM public.class_chat_rooms ccr
            WHERE ccr.id = class_chat_messages.room_id
              AND ccr.school_id = public.get_my_school_id()
        )
    );

CREATE POLICY "ccmsg_super_admin" ON public.class_chat_messages
    FOR ALL USING (public.is_super_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 5: REALTIME
-- ═══════════════════════════════════════════════════════════════════════════

-- تفعيل REPLICA IDENTITY FULL للـ Realtime
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

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 6: GRANTS
-- ═══════════════════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 7: TRIGGER — updated_at for electronic_exams
-- ═══════════════════════════════════════════════════════════════════════════

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

NOTIFY pgrst, 'reload schema';
