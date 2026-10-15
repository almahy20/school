# Implementation Plan

## Overview

خطة التنفيذ تتبع منهجية البحث عن الأخطاء قبل الإصلاح: نكتب أولاً الاختبارات التي تُثبت وجود المشاكل الأربع، ثم نكتب اختبارات الحفاظ على السلوك الصحيح، ثم نُطبق الإصلاحات الأربعة الجراحية الدقيقة، وأخيراً نتحقق من نجاح الكل.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "2"] },
    { "wave": 2, "tasks": ["3.1", "3.2", "3.3", "3.4"] },
    { "wave": 3, "tasks": ["3.5", "3.6"] },
    { "wave": 4, "tasks": ["4"] }
  ]
}
```

## Tasks

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Migration Timestamp Conflict, Client-side Scoring, Broken Unicode, Unused Variable
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate all four bugs exist simultaneously
  - **Scoped PBT Approach**: Scope each property to the concrete failing case(s) for deterministic reproducibility
  - Bug 1 — read the migration file list and assert all timestamps are unique: `extractTimestamps(migrationFiles)` has duplicates (`20260913000000` appears twice) → assertion fails
  - Bug 2 — call `mutationFn` with a simulated non-JWT RPC error (e.g. `{ message: 'RPC function not found', code: 'PGRST204' }`) and assert it throws `'فشل إرسال الاختبار — يرجى المحاولة مرة أخرى'` → currently returns a score instead of throwing
  - Bug 3 — read `src/contexts/AuthContext.tsx` and assert none of the four affected log strings contain `â€"` → currently they do
  - Bug 4 — read `src/hooks/queries/useStats.ts` and assert `fetchStatsFallback` does NOT declare `const schoolFilter =` → currently it does
  - Run all assertions on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct — it proves the bugs exist)
  - Document counterexamples found:
    - Bug 1: two files share timestamp `20260913000000`
    - Bug 2: non-JWT RPC error triggers client-side scoring using `q.correct_answer`
    - Bug 3: `â€"` found in 4 log strings
    - Bug 4: `const schoolFilter = !user?.isSuperAdmin && user?.schoolId;` present but unused
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - RPC Success Path, fetchStatsFallback Results, AuthContext Behaviour
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: calling `mutationFn` with `rpcError = null` and `rpcResult = { score: 8, total_score: 10, questions: [...] }` returns `{ score: 8, totalScore: 10, questions, answers }` on unfixed code
  - Observe: calling `fetchStatsFallback({ schoolId: 'school-123', isSuperAdmin: false })` executes all 7 queries with `.eq('school_id', 'school-123')` on unfixed code
  - Observe: JWT-error path in `mutationFn` still calls `supabase.auth.refreshSession()` and retries the RPC on unfixed code
  - Write property-based tests:
    - For all valid `rpcResult` shapes (any score 0–N, any questions array), the mutation returns data built from `rpcResult` — never from `q.correct_answer`
    - For all `user` objects with a non-null `schoolId`, `fetchStatsFallback` produces queries filtered by `user.schoolId` directly
    - For all error objects where `isJwtError = true`, the JWT retry path is taken and client-side fallback is NOT triggered
  - Verify all preservation tests PASS on UNFIXED code before moving to implementation
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 3. Fix all four bugs

  - [ ] 3.1 Bug 1 — Rename conflicting migration file
    - Rename `supabase/migrations/20260913000000_add_grades_upsert_unique_constraint.sql` to `supabase/migrations/20260913000100_add_grades_upsert_unique_constraint.sql`
    - Do NOT modify the SQL content of the file — rename only
    - Verify the three-file ordering after rename: `000000_fix_critical_issues` → `000001_fix_pg_net_push_notifications` → `000100_add_grades_upsert_unique_constraint`
    - _Bug_Condition: isBugCondition_1(migrationFiles) — two files share timestamp `20260913000000`_
    - _Expected_Behavior: all timestamps in migration file names are unique; `supabase db push` completes without conflict errors_
    - _Preservation: SQL content of both files stays byte-for-byte identical; no data is deleted or modified_
    - _Requirements: 2.1, 2.2, 3.1, 3.2_

  - [ ] 3.2 Bug 2 — Remove client-side exam scoring fallback in useElectronicExams.ts
    - Open `src/hooks/queries/useElectronicExams.ts` → locate `useSubmitExamAttempt` → find the `mutationFn`
    - Keep the proactive session refresh block (step 1) untouched
    - Keep the JWT retry block (step 3) for the RPC call untouched
    - Keep the `if (!rpcError && rpcResult) { ... return { score, totalScore, questions, answers }; }` success block untouched
    - Delete everything from `// Fallback: direct UPSERT...` through the final `return { score, totalScore, questions, answers };` of the fallback
    - Replace deleted code with: `logger.error('[Exam] submit_exam_attempt RPC failed:', rpcError?.message); throw new Error('فشل إرسال الاختبار — يرجى المحاولة مرة أخرى');`
    - Confirm `correct_answer` is never accessed outside the `if (!rpcError && rpcResult)` block after the change
    - _Bug_Condition: isBugCondition_2(rpcError, rpcResult) — rpcError is non-null AND is not a JWT error_
    - _Expected_Behavior: throws `Error('فشل إرسال الاختبار — يرجى المحاولة مرة أخرى')` without reading `correct_answer` or writing to `exam_attempts`_
    - _Preservation: RPC success path returns `{ score, totalScore, questions, answers }` from server data unchanged; JWT retry path triggers `supabase.auth.refreshSession()` then retries RPC unchanged_
    - _Requirements: 2.3, 2.4, 2.5, 3.3, 3.4_

  - [ ] 3.3 Bug 3 — Fix broken Unicode em dashes in AuthContext.tsx
    - Open `src/contexts/AuthContext.tsx`
    - Replace all four occurrences of `â€"` with `—` (U+2014 em dash):
      - `logger.warn('[Auth] Skipping background RPC â€" no valid access token')` → `logger.warn('[Auth] Skipping background RPC — no valid access token')`
      - `logger.log('[Auth] Background RPC skipped â€" already loading for this user')` → `logger.log('[Auth] Background RPC skipped — already loading for this user')`
      - `logger.log('[Auth] Background RPC skipped â€" JWT complete + recently synced')` → `logger.log('[Auth] Background RPC skipped — JWT complete + recently synced')`
      - `logger.log('[Auth] SIGNED_OUT ignored â€" active session exists (token rotation)')` → `logger.log('[Auth] SIGNED_OUT ignored — active session exists (token rotation)')`
    - Do NOT change any logic, call levels, or surrounding code
    - _Bug_Condition: isBugCondition_3(logMessage) — logMessage CONTAINS `â€"`_
    - _Expected_Behavior: all four log strings contain `—` and do NOT contain `â€"`_
    - _Preservation: logger call levels (warn/log) and all surrounding logic in `applySession` and `onAuthStateChange` remain unchanged_
    - _Requirements: 2.6, 3.5_

  - [ ] 3.4 Bug 4 — Remove unused schoolFilter variable in useStats.ts
    - Open `src/hooks/queries/useStats.ts` → locate `fetchStatsFallback`
    - Delete the single line: `const schoolFilter = !user?.isSuperAdmin && user?.schoolId;`
    - Do NOT modify any query in the function — all queries already use `user.schoolId` directly and must stay that way
    - _Bug_Condition: isBugCondition_4(sourceCode) — `const schoolFilter =` is present AND schoolFilter is never used in any query after declaration_
    - _Expected_Behavior: `fetchStatsFallback` contains no `schoolFilter` declaration_
    - _Preservation: all 7 queries continue to use `user.schoolId` directly; return value of `fetchStatsFallback` is byte-for-byte identical in behaviour_
    - _Requirements: 2.7, 3.6_

  - [ ] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - All four bug conditions eliminated
    - **IMPORTANT**: Re-run the SAME tests from task 1 — do NOT write new tests
    - The tests from task 1 encode the expected behavior for all four bugs
    - When all four assertions pass, it confirms every bug condition has been resolved
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Tests PASS (confirms all four bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 2.7_

  - [ ] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - No regressions introduced
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all preservation tests still pass after all four fixes

- [ ] 4. Checkpoint — Ensure all tests pass and build is clean
  - Run `tsc --noEmit` (or the project's TypeScript check command) and confirm zero errors
  - Confirm no unused-variable warnings remain for `schoolFilter`
  - Confirm migration file list has no duplicate timestamps: `ls supabase/migrations/ | cut -c1-14 | sort | uniq -d` returns empty
  - Ensure all tests from tasks 1 and 2 pass
  - Ask the user if any questions arise

## Notes

- جميع الإصلاحات الأربعة مستقلة ويمكن تطبيقها بأي ترتيب بعد إتمام مرحلتي الاختبار (1 و 2)
- Bug 1: إعادة التسمية فقط — لا تعديل في محتوى SQL أبداً
- Bug 2: حذف كود الـ fallback فقط — منطق JWT retry يبقى كما هو حرفاً بحرف
- Bug 3: استبدال نصي بحت — لا تغيير في أي منطق تشغيلي
- Bug 4: حذف سطر واحد — لا تعديل في أي query
