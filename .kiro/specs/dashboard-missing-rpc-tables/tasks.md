# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - PostgREST Schema Cache Miss
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate PostgREST returns 404/400 for entities that exist in DB
  - **Scoped PBT Approach**: Scope the property to each of the 7 concrete failing entities individually for reproducibility
  - Test each of the following calls and assert they return HTTP 2xx (from Bug Condition in design):
    - `supabase.rpc('get_dashboard_stats', { p_school_id, p_is_super_admin })` → expect 2xx, currently returns PGRST202
    - `supabase.rpc('get_admin_dashboard_activities', { p_school_id })` → expect 2xx, currently returns 404
    - `supabase.rpc('get_unread_notification_counts', { p_user_id })` → expect 2xx, currently returns 404
    - `supabase.rpc('get_fees_summary', { p_school_id })` → expect 2xx, currently returns 404
    - `supabase.from('notifications').select('*').limit(1)` → expect 2xx, currently returns 404
    - `supabase.from('conversations').select('unread_by_parent').limit(1)` → expect 2xx, currently returns 404
    - `supabase.from('profiles').select('notification_prefs').eq('id', userId)` → expect 2xx, currently returns 400
  - The test assertions check that `error === null` and `status` is in [200, 206]
  - Run test on UNFIXED code (before applying migration `20260904000000`)
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found:
    - e.g. `get_dashboard_stats(schoolId, false)` → `{ code: 'PGRST202', message: 'Could not find the function...' }`
    - e.g. `profiles?select=notification_prefs` → `{ code: 'PGRST204', message: '400 Bad Request' }`
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing RPC and Table Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (entities NOT in isBugCondition):
    - `supabase.rpc('get_child_full_details', { p_student_id, p_school_id })` → record response structure
    - `supabase.rpc('get_parent_dashboard_summary', { p_parent_id, p_school_id })` → record response structure
    - `supabase.rpc('get_teacher_dashboard_stats', { p_school_id })` → record response structure
    - `supabase.from('profiles').select('id, full_name, phone, school_id, created_at')` → confirm 2xx
    - `supabase.from('conversations').select('id, status, parent_id')` (for parent user) → confirm 2xx
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - For all valid `(school_id_A, school_id_B)` where A ≠ B: data returned for A must not include rows from B (RLS isolation)
    - For all authenticated users: base profile columns still return 2xx
    - For all parent users with conversations: conversation list still returns without error
  - Property-based testing generates many random `school_id` / `user_id` combinations for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 3. Fix — إنشاء migration إعادة تسجيل الكيانات في schema cache

  - [ ] 3.1 إنشاء ملف `supabase/migrations/20260904000000_force_schema_cache_reload.sql`
    - أرسل `NOTIFY pgrst, 'reload schema'` في أول السطر لإعادة تحميل cache مبكراً
    - أضف `SET search_path TO public`
    - _Bug_Condition: isBugCondition(request) حيث الكيان موجود في DB لكن مفقود من schema cache_
    - _Expected_Behavior: بعد تطبيق الـ migration يُعيد PostgREST 2xx لكل الكيانات السبعة_
    - _Preservation: لا تغيير في منطق الدوال ولا في RLS policies الحالية_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ] 3.2 إعادة تسجيل `get_dashboard_stats` بـ CREATE OR REPLACE
    - انسخ كامل body الدالة من `20260903100000_fix_slow_rpc_functions.sql` بدون تغيير
    - نفس signature: `(p_school_id UUID, p_is_super_admin BOOLEAN) RETURNS JSONB`
    - نفس `LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public`
    - أعد `REVOKE EXECUTE FROM public, anon` و `GRANT EXECUTE TO authenticated, service_role`
    - _Requirements: 2.1_

  - [ ] 3.3 إعادة تسجيل `get_admin_dashboard_activities` بـ CREATE OR REPLACE
    - انسخ كامل body الدالة من `20260903100000_fix_slow_rpc_functions.sql` بدون تغيير
    - نفس signature: `(p_school_id uuid) RETURNS jsonb`
    - نفس `LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public`
    - أعد `REVOKE EXECUTE FROM public, anon` و `GRANT EXECUTE TO authenticated, service_role`
    - _Requirements: 2.2_

  - [ ] 3.4 إعادة تسجيل `get_unread_notification_counts` بـ CREATE OR REPLACE
    - انسخ كامل body الدالة من `20260903100000_fix_slow_rpc_functions.sql` بدون تغيير
    - نفس signature: `(p_user_id uuid) RETURNS jsonb`
    - نفس `LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public`
    - أعد `GRANT EXECUTE TO authenticated` و `REVOKE EXECUTE FROM anon`
    - _Requirements: 2.3_

  - [ ] 3.5 إعادة تسجيل `get_fees_summary` بـ CREATE OR REPLACE
    - انسخ كامل body الدالة من `20260807000000_create_get_fees_summary_rpc.sql` بدون تغيير
    - نفس signature: `(p_school_id uuid, p_class_id text DEFAULT NULL, p_term text DEFAULT '') RETURNS TABLE (total_due numeric, total_paid numeric)`
    - نفس `LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_catalog`
    - أعد `REVOKE ALL FROM PUBLIC` و `GRANT EXECUTE TO authenticated`
    - _Requirements: 2.4_

  - [ ] 3.6 ضمان وجود عمود `notification_prefs` في جدول `profiles`
    - ```sql
      ALTER TABLE public.profiles
        ADD COLUMN IF NOT EXISTS notification_prefs JSONB;
      ```
    - الأمر idempotent بفضل `IF NOT EXISTS` — لن يُخطئ إذا كان العمود موجوداً
    - _Requirements: 2.7_

  - [ ] 3.7 ضمان وجود عمود `unread_by_parent` في جدول `conversations`
    - ```sql
      ALTER TABLE public.conversations
        ADD COLUMN IF NOT EXISTS unread_by_parent INT NOT NULL DEFAULT 0;
      ```
    - الأمر idempotent بفضل `IF NOT EXISTS`
    - _Requirements: 2.6_

  - [ ] 3.8 إرسال `NOTIFY pgrst, 'reload schema'` في نهاية الـ migration
    - أضف `SELECT pg_sleep(0.1)` قبل الـ NOTIFY الأخير لضمان اكتمال transaction أولاً
    - أرسل `NOTIFY pgrst, 'reload schema'` مرة ثانية في نهاية الملف
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ] 3.9 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - PostgREST Schema Cache Miss Fixed
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (HTTP 2xx for all 7 entities)
    - Apply migration `20260904000000_force_schema_cache_reload.sql` on the database
    - Re-run all 7 sub-tests from task 1
    - **EXPECTED OUTCOME**: All 7 sub-tests PASS (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ] 3.10 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing RPC and Table Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run all preservation property tests from step 2 after applying the migration
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm: `get_child_full_details`, `get_parent_dashboard_summary`, `get_teacher_dashboard_stats` still return correct data
    - Confirm: RLS multi-tenant isolation still enforced (school A cannot see school B data)
    - Confirm: base profile columns (`id`, `full_name`, `phone`, `school_id`, `created_at`) still return correctly
    - Confirm: parent conversation list still loads without error

- [ ] 4. Checkpoint — Ensure all tests pass
  - تشغيل كامل مجموعة الاختبارات (exploration + preservation)
  - التحقق من Console المتصفح خلال تحميل الداشبورد: لا أخطاء PGRST202، لا 404، لا 400
  - التحقق من تحميل صفحة الإشعارات: عدد الإشعارات غير المقروءة يظهر بشكل صحيح
  - التحقق من صفحة البروفايل: `notification_prefs` يُحمَّل بدون خطأ 400
  - التحقق من قائمة محادثات ولي الأمر: `unread_by_parent` يظهر بشكل صحيح
  - Ensure all tests pass, ask the user if questions arise.
