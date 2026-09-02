-- ==========================================================================
-- Migration: 20260903200000_fix_security_linter_anon_grants.sql
-- Purpose  : إصلاح تحذيرات Security Linter — سحب صلاحيات anon من الدوال
--            التي لا يجب أن يصل إليها المستخدمون غير المسجلين
--
-- القرارات:
--   KEEP anon access:
--     - get_school_id_by_slug : تُستدعى في صفحة التسجيل قبل تسجيل الدخول
--
--   REVOKE anon access:
--     - get_complete_user_data : تُعيد profile+role+school لأي user_id (حساسة)
--     - get_auth_school_id     : تستخدم auth.uid() — بلا قيمة بدون session
--     - is_school_admin        : نفس السبب
--     - log_action             : تكتب في audit log
--     - recalculate_exam_scores: عملية admin
--     - submit_exam_attempt    : يجب أن يكون المستخدم مسجلاً
--
--   authenticated warnings: مقصودة — المستخدمون المسجلون يستدعون هذه الدوال
--     فعلاً (مؤكد من Edge logs). لا تغيير مطلوب.
--
-- ملاحظة: pg_net في public schema — تحذير informational فقط، لا يمكن نقله
--         بدون إعادة تهيئة الـ extension ويحتاج Supabase support.
-- ==========================================================================

SET search_path TO public;

-- ==========================================================================
-- 1. get_complete_user_data — سحب من anon (منح خاطئ من migration قديم)
-- ==========================================================================
REVOKE EXECUTE ON FUNCTION public.get_complete_user_data(uuid) FROM anon;
-- الإبقاء على authenticated و service_role (مُستخدمة في AuthContext.tsx)
GRANT EXECUTE ON FUNCTION public.get_complete_user_data(uuid) TO authenticated, service_role;

-- ==========================================================================
-- 2. get_auth_school_id — سحب من anon
-- ==========================================================================
REVOKE EXECUTE ON FUNCTION public.get_auth_school_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_auth_school_id() TO authenticated, service_role;

-- ==========================================================================
-- 3. is_school_admin — سحب من anon
-- ==========================================================================
REVOKE EXECUTE ON FUNCTION public.is_school_admin(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_school_admin(uuid) TO authenticated, service_role;

-- ==========================================================================
-- 4. log_action — سحب من anon
-- ==========================================================================
REVOKE EXECUTE ON FUNCTION public.log_action(text, text, uuid, text, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_action(text, text, uuid, text, jsonb, jsonb) TO authenticated, service_role;

-- ==========================================================================
-- 5. recalculate_exam_scores — سحب من anon
-- ==========================================================================
REVOKE EXECUTE ON FUNCTION public.recalculate_exam_scores(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.recalculate_exam_scores(uuid) TO authenticated, service_role;

-- ==========================================================================
-- 6. submit_exam_attempt — سحب من anon
-- ==========================================================================
REVOKE EXECUTE ON FUNCTION public.submit_exam_attempt(uuid, uuid, uuid, jsonb, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_exam_attempt(uuid, uuid, uuid, jsonb, integer, integer) TO authenticated, service_role;

-- ==========================================================================
-- 7. get_school_id_by_slug — الإبقاء على anon (مقصود للـ signup page)
--    فقط نتأكد من صحة المنح الحالي
-- ==========================================================================
GRANT EXECUTE ON FUNCTION public.get_school_id_by_slug(text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
