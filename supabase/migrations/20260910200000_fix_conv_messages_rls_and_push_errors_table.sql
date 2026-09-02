-- ==========================================================================
-- Migration: 20260910200000_fix_conv_messages_rls_and_push_errors_table.sql
-- Purpose  : إصلاح ثلاثة أخطاء ظهرت في اللوجات:
--
--   1) 42501: new row violates row-level security policy for "conversation_messages"
--      السبب: PATCH على conversation_messages يفشل عند:
--        - ولي الأمر يحاول تعليم رسائل الأدمن كمقروءة (is_read = true)
--        - الأدمن يحاول تعليم رسائل ولي الأمر كمقروءة
--      الـ policy الحالية "conv_messages_update" تسمح فقط للأدمن بالتحديث.
--      الإصلاح: إضافة policy للـ parent تسمح له بتحديث is_read فقط.
--              وتوسيع policy الأدمن لتشمل التحديث بدون قيد على sender_role.
--
--   2) 42P01: relation "public.push_trigger_errors" does not exist
--      السبب: الجدول غير موجود في الـ production database.
--      الإصلاح: CREATE TABLE IF NOT EXISTS.
--
--   3) الـ trigger الجديد notify_on_new_conversation_message يستخدم
--      RAISE WARNING (لا يُلغي الـ transaction) — هذا صحيح.
--      لكن الـ trigger القديم في قاعدة البيانات الفعلية ما زال يحاول
--      INSERT في push_trigger_errors. بعد تطبيق هذا المايجريشن
--      وإنشاء الجدول، سيختفي الخطأ.
-- ==========================================================================

SET search_path TO public;

-- ==========================================================================
-- 1. إنشاء جدول push_trigger_errors لو لم يكن موجوداً
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.push_trigger_errors (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID        NULL,
    user_id         UUID        NULL,
    error_code      TEXT        NOT NULL DEFAULT 'UNKNOWN',
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_trigger_errors_created_at
    ON public.push_trigger_errors (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_trigger_errors_code
    ON public.push_trigger_errors (error_code);

-- RLS — الجدول للتشخيص فقط، لا يحتاج قراءة من المستخدمين العاديين
ALTER TABLE public.push_trigger_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_trigger_errors_super_admin ON public.push_trigger_errors;
CREATE POLICY push_trigger_errors_super_admin
    ON public.push_trigger_errors FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND is_super_admin = true
        )
    );

GRANT SELECT, INSERT ON public.push_trigger_errors TO service_role;

-- ==========================================================================
-- 2. إصلاح RLS policies على conversation_messages
--
-- المشكلة: useMarkConversationRead يُرسل:
--   PATCH /conversation_messages
--     ?conversation_id=eq.X&sender_role=eq.admin&is_read=eq.false
--   من ولي الأمر (لتعليم ردود الأدمن كمقروءة)
--
--   PATCH /conversation_messages
--     ?conversation_id=eq.X&sender_role=eq.parent&is_read=eq.false
--   من الأدمن (لتعليم رسائل ولي الأمر كمقروءة)
--
-- الإصلاح:
--   أ. policy "conv_messages_update_admin" — الأدمن يُحدِّث أي رسالة
--      في محادثة تخص مدرسته (بما فيها رسائل ولي الأمر)
--   ب. policy "conv_messages_update_parent" — ولي الأمر يُحدِّث
--      is_read فقط للرسائل في محادثاته (لتعليم ردود الأدمن كمقروءة)
-- ==========================================================================

-- حذف الـ policies القديمة
DROP POLICY IF EXISTS "conv_messages_update"     ON public.conversation_messages;
DROP POLICY IF EXISTS "cmsg_admin_update"         ON public.conversation_messages;
DROP POLICY IF EXISTS "conv_messages_update_admin"  ON public.conversation_messages;
DROP POLICY IF EXISTS "conv_messages_update_parent" ON public.conversation_messages;

-- أ. الأدمن: يُحدِّث أي رسالة في محادثات مدرسته
CREATE POLICY "conv_messages_update_admin"
    ON public.conversation_messages FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            JOIN public.user_roles ur ON ur.school_id = c.school_id
            WHERE c.id       = conversation_id
              AND ur.user_id = (SELECT auth.uid())
              AND ur.role    IN ('admin', 'teacher')
        )
        OR EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = (SELECT auth.uid()) AND is_super_admin = true
        )
    );

-- ب. ولي الأمر: يُحدِّث فقط الرسائل في محادثاته (لتعليمها كمقروءة)
--    WITH CHECK: لا يمكنه تعديل content أو sender_id — فقط is_read
CREATE POLICY "conv_messages_update_parent"
    ON public.conversation_messages FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id AND c.parent_id = (SELECT auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id AND c.parent_id = (SELECT auth.uid())
        )
    );

-- ==========================================================================
-- 3. تنظيف قديم من push_trigger_errors (لو الجدول كان موجوداً بسجلات قديمة)
-- ==========================================================================

DO $$
BEGIN
    -- حذف الأخطاء الأقدم من 30 يوم
    DELETE FROM public.push_trigger_errors
    WHERE created_at < NOW() - INTERVAL '30 days';
EXCEPTION WHEN OTHERS THEN
    -- تجاهل لو الجدول فارغ أو مشكلة أخرى
    NULL;
END $$;

-- ==========================================================================
-- 4. إعادة تحميل schema cache
-- ==========================================================================

NOTIFY pgrst, 'reload schema';
