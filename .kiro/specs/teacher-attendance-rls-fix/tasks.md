# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Invalid Column Reference in Admins RLS Policy
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate error `42703` exists in the current RLS policy
  - **Scoped PBT Approach**: Scope the property to the concrete failing case: any `SELECT/INSERT/UPDATE/DELETE` on `public.teacher_attendance` by an admin user triggers error `42703`
  - Query `pg_policies` and assert that NO policy on `teacher_attendance` references `profiles.role`:
    ```sql
    SELECT COUNT(*) FROM pg_policies
    WHERE tablename = 'teacher_attendance'
      AND (qual LIKE '%profiles.role%' OR with_check LIKE '%profiles.role%');
    -- Expected after fix: 0
    -- Current (buggy): > 0  ← FAILS here, confirming the bug
    ```
  - Alternatively: attempt a dummy admin SELECT and assert no `42703` error is thrown
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (confirms the bug — `profiles.role` IS referenced)
  - Document counterexamples found (e.g., policy `"Admins full access"` qual contains `profiles.role`)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Teachers View Own and Data Integrity Unaffected
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: `SELECT COUNT(*) FROM teacher_attendance WHERE teacher_id = auth.uid()` succeeds on unfixed code (policy `"Teachers view own"` works correctly)
  - Observe: total row count of `teacher_attendance` is stable
  - Observe: indexes `idx_teacher_attendance_school`, `idx_teacher_attendance_teacher`, `idx_teacher_attendance_date` exist
  - Observe: policies on all other tables (`profiles`, `user_roles`, `complaints`, `fees`) are unaffected
  - Write property-based tests that assert:
    1. For ALL teacher user IDs, `SELECT` on their own records succeeds with same results before and after fix
    2. Row count of `teacher_attendance` is unchanged after applying migration
    3. All three indexes on `teacher_attendance` still exist after migration
    4. Number of policies on `teacher_attendance` remains exactly 2 after fix
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 3. Fix RLS policies for teacher_attendance — replace profiles.role with user_roles

  - [ ] 3.1 Create migration `20260903000000_fix_teacher_attendance_rls.sql`
    - Drop ALL broken policies that reference `profiles.role`:
      ```sql
      DROP POLICY IF EXISTS "Admins full access" ON public.teacher_attendance;
      DROP POLICY IF EXISTS "Admins can manage teacher attendance" ON public.teacher_attendance;
      DROP POLICY IF EXISTS "Admin full access to teacher attendance" ON public.teacher_attendance;
      DROP POLICY IF EXISTS "Authenticated users can read" ON public.teacher_attendance;
      ```
    - Re-create the admin policy using `public.user_roles` (the correct pattern used throughout the project):
      ```sql
      CREATE POLICY "Admins full access"
        ON public.teacher_attendance
        FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
              AND user_roles.role = 'admin'
              AND user_roles.approval_status = 'approved'
              AND user_roles.school_id = teacher_attendance.school_id
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
              AND user_roles.role = 'admin'
              AND user_roles.approval_status = 'approved'
              AND user_roles.school_id = teacher_attendance.school_id
          )
        );
      ```
    - Re-enable RLS (in case it was disabled by `20260413000003`):
      ```sql
      ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;
      ```
    - Keep `"Teachers view own"` policy unchanged — it already uses `teacher_id = auth.uid()` which is correct
    - Add `NOTIFY pgrst, 'reload schema';` at the end
    - Do NOT use `DROP TABLE` or `CASCADE` — only drop policies
    - Make migration idempotent using `DROP POLICY IF EXISTS`
    - _Bug_Condition: isBugCondition(X) where X.policy references "profiles.role" on teacher_attendance_
    - _Expected_Behavior: evaluatePolicy'(X) ≠ ERROR_42703 AND result is boolean (true if admin, false otherwise)_
    - _Preservation: "Teachers view own" policy and all teacher_attendance data and indexes remain unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

  - [ ] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - No Policy References Invalid Column profiles.role
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior: zero policies on `teacher_attendance` reference `profiles.role`
    - When this test passes, it confirms error `42703` is resolved
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed — count of bad policies = 0)
    - _Requirements: 2.1, 2.2_

  - [ ] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Teachers View Own and Data Integrity Unaffected
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Verify: teacher SELECT on own records returns same results
    - Verify: row count of `teacher_attendance` unchanged
    - Verify: all three indexes still exist
    - Verify: policy count on `teacher_attendance` is exactly 2
    - Confirm all tests still pass after fix (no regressions)

- [ ] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Confirm migration file `20260903000000_fix_teacher_attendance_rls.sql` exists in `supabase/migrations/`
  - Confirm no policy on `teacher_attendance` references `profiles.role`
  - Confirm admin operations on `teacher_attendance` succeed without error `42703`
  - Confirm teacher self-view still works
  - Confirm zero data loss in `teacher_attendance`
