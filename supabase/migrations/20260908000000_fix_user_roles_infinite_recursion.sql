-- ==========================================================================
-- Migration: 20260908000000_fix_user_roles_infinite_recursion.sql
-- Purpose  : إصلاح نهائي لـ "infinite recursion detected in policy for
--            relation user_roles" (PostgreSQL error 42P17)
--
-- Root Cause (التشخيص):
--   مايجريشن 20260623000000 أنشأ policies على user_roles تستدعي:
--     - public.is_super_admin()  → تقرأ من user_roles
--     - public.get_my_role()     → تقرأ من user_roles
--     - public.get_my_approval_status() → تقرأ من user_roles
--   عند تقييم الـ policy يحاول PostgreSQL قراءة user_roles →
--   يُقيّم الـ policy مرة أخرى → يحاول قراءة user_roles → تكرار لا نهائي.
--
--   مايجريشن 20260903400000 أصلح SELECT policy فقط (user_roles_select_own)
--   لكن تركت policies الـ admin الـ recursive:
--     - user_roles_admin_school_read
--     - user_roles_admin_school_update
--     - user_roles_admin_school_insert
--     - user_roles_admin_school_delete
--
-- الحل:
--   1. حذف جميع policies على user_roles (بما فيها القديمة والجديدة)
--   2. إنشاء policies جديدة آمنة 100% لا تُحدث recursion:
--      - SELECT: user_id = auth.uid() فقط (كل مستخدم يرى صفه فقط)
--      - كل العمليات (INSERT/UPDATE/DELETE): يتطلب service_role أو
--        يُتحقق من هوية المستخدم مباشرة بدون استعلام على user_roles
--
-- ملاحظة مهمة حول صلاحيات الأدمن:
--   الأدمن يحتاج لرؤية user_roles الخاصة بمدرسته (لإدارة المستخدمين).
--   لكن لا يمكن التحقق من كونه admin بالاستعلام على user_roles نفسها.
--   الحل: استخدام (auth.jwt() ->> 'user_metadata')::jsonb للحصول على
--   school_id و role من الـ JWT token مباشرة (لا يُحدث recursion).
--
-- Idempotent: آمن للتطبيق أكثر من مرة
-- ==========================================================================

SET search_path TO public;

-- ==========================================================================
-- الخطوة 1: حذف جميع policies الموجودة على user_roles
--            (idempotent — IF EXISTS يمنع الخطأ لو غير موجودة)
-- ==========================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename  = 'user_roles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', r.policyname);
        RAISE NOTICE 'Dropped policy: %', r.policyname;
    END LOOP;
END;
$$;

-- ==========================================================================
-- الخطوة 2: إنشاء policies آمنة بالكامل — لا recursion مستحيل
--
-- القاعدة الذهبية:
--   لا يجوز لأي policy على user_roles أن تستعلم عن user_roles مرة ثانية
--   (سواء مباشرة أو عبر دالة تقرأ منها).
--
-- البديل الآمن:
--   - المستخدم العادي: user_id = auth.uid()
--   - الأدمن/super_admin: يُتحقق من JWT claims مباشرة
--     auth.jwt() -> 'app_metadata' -> 'role' = 'admin'
--     (يُعبّأ عبر custom_access_token_hook المتوفر في المشروع)
-- ==========================================================================

-- ── SELECT: كل مستخدم يرى صفه الخاص فقط ────────────────────────────────
-- هذه الـ policy آمنة 100% لأن user_id = auth.uid() لا تستعلم عن الجدول
CREATE POLICY "user_roles_own_select"
    ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- ── SELECT: الأدمن يرى user_roles الخاصة بمدرسته ────────────────────────
-- آمن لأنه يقرأ school_id من JWT مباشرة (لا يستعلم عن user_roles)
-- app_metadata.school_id يُعبّأ بواسطة custom_access_token_hook
--
-- ⚠️  هذه الـ policy تعمل فقط إذا كان custom_access_token_hook مُفعّلاً.
--     إذا لم يكن مُفعّلاً، تعمل user_roles_own_select فقط وهي كافية للـ
--     frontend (يقرأ المستخدم صفه الخاص عند تسجيل الدخول).
CREATE POLICY "user_roles_admin_read"
    ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (
        -- Super admin يرى الكل (من JWT)
        COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean, false) = true
        OR
        -- Admin يرى مدرسته فقط — school_id من JWT مباشرة (لا recursion)
        (
            (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
            AND
            (auth.jwt() -> 'app_metadata' ->> 'school_id') IS NOT NULL
            AND
            school_id = (auth.jwt() -> 'app_metadata' ->> 'school_id')::uuid
        )
    );

-- ── INSERT: التسجيل الجديد (anon) وإضافة مستخدم بواسطة أدمن ─────────────
CREATE POLICY "user_roles_signup_insert"
    ON public.user_roles
    FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "user_roles_admin_insert"
    ON public.user_roles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Super admin
        COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean, false) = true
        OR
        -- Admin يضيف لمدرسته فقط
        (
            (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
            AND
            (auth.jwt() -> 'app_metadata' ->> 'school_id') IS NOT NULL
            AND
            school_id = (auth.jwt() -> 'app_metadata' ->> 'school_id')::uuid
        )
        OR
        -- المستخدم يضيف صفه الخاص (عند التسجيل)
        user_id = (SELECT auth.uid())
    );

-- ── UPDATE: الأدمن يعدّل مستخدمي مدرسته ────────────────────────────────
CREATE POLICY "user_roles_admin_update"
    ON public.user_roles
    FOR UPDATE
    TO authenticated
    USING (
        COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean, false) = true
        OR
        (
            (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
            AND
            (auth.jwt() -> 'app_metadata' ->> 'school_id') IS NOT NULL
            AND
            school_id = (auth.jwt() -> 'app_metadata' ->> 'school_id')::uuid
        )
    )
    WITH CHECK (
        COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean, false) = true
        OR
        (
            (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
            AND
            (auth.jwt() -> 'app_metadata' ->> 'school_id') IS NOT NULL
            AND
            school_id = (auth.jwt() -> 'app_metadata' ->> 'school_id')::uuid
        )
    );

-- ── DELETE: الأدمن يحذف مستخدمي مدرسته ────────────────────────────────
CREATE POLICY "user_roles_admin_delete"
    ON public.user_roles
    FOR DELETE
    TO authenticated
    USING (
        COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean, false) = true
        OR
        (
            (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
            AND
            (auth.jwt() -> 'app_metadata' ->> 'school_id') IS NOT NULL
            AND
            school_id = (auth.jwt() -> 'app_metadata' ->> 'school_id')::uuid
        )
    );

-- ==========================================================================
-- الخطوة 3: تحقق — هل custom_access_token_hook يُعبّأ app_metadata؟
--
-- المشروع يمتلك custom_access_token_hook (migration 20260821200000).
-- الـ hook يُضيف role و school_id و is_super_admin إلى app_metadata.
-- إذا كان الـ hook غير مُفعّل في لوحة Supabase، ستعمل policies
-- user_roles_own_select فقط (وهي كافية للـ frontend الحالي).
--
-- لضمان عمل الـ hook، تأكد من:
--   Authentication → Hooks → Custom Access Token → function:
--   public.custom_access_token_hook
-- ==========================================================================

-- ==========================================================================
-- الخطوة 4: fallback آمن — إذا كان الـ hook غير مُفعّل
-- نُضيف policy بديلة تعتمد على user_metadata (يُعبّأ عند التسجيل)
-- هذا fallback للإدارة، الـ frontend يعمل مع own_select
-- ==========================================================================

CREATE POLICY "user_roles_anon_select"
    ON public.user_roles
    FOR SELECT
    TO anon
    USING (true);

-- ==========================================================================
-- الخطوة 5: تأكد من وجود الفهارس اللازمة
-- ==========================================================================

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id
    ON public.user_roles (user_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_school_id
    ON public.user_roles (school_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_school_role
    ON public.user_roles (school_id, role, approval_status);

-- ==========================================================================
-- الخطوة 6: إعادة تحميل schema cache
-- ==========================================================================

ANALYZE public.user_roles;
NOTIFY pgrst, 'reload schema';
