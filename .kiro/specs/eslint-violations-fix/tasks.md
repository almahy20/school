# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - ESLint Zero Violations
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate ESLint violations exist
  - **Scoped PBT Approach**: Scope the property to the concrete failing locations listed below for reproducibility
  - Run ESLint on unfixed code targeting all three rules:
    ```
    npx eslint src --ext .ts,.tsx --rule "no-empty: error" --rule "react-hooks/exhaustive-deps: error" --rule "prefer-const: error" --format json > eslint-baseline.json
    ```
  - Verify that violations exist in the following locations (from `isBugCondition` in design):
    - **no-empty** (24 violations): `ExamTakingView.tsx:135,152,175,222,280,285`, `supabase/client.ts:80,104`, `CreateExamWizard.tsx:132,197`, `ElectronicExamsView.tsx:43`, `AdminClassChatRoomPage.tsx:50`, `AdminConversationsPage.tsx:416`, `AdminConversationDetailPage.tsx:146`, `ClassChatRoomPage.tsx:100`, `ParentConversationsPage.tsx:156,342`, `StudentsPage.tsx:458`, `useStudents.ts:313`
    - **react-hooks/exhaustive-deps** (17 violations): `GlobalAnnouncement.tsx:156`, `QueryStateHandler.tsx:66`, `CreateExamWizard.tsx:101`, `ClassExamsView.tsx:117,162,177,188,194`, `GradesPage.tsx:81,99,107`, `useClassChat.ts:57,136,209,304`, `useConversations.ts:206`, `useElectronicExams.ts:382`, `ClassChatRoomPage.tsx:80,85`, `AdminConversationDetailPage.tsx:129,135`, `ParentConversationsPage.tsx:138`, `StudentDetailPage.tsx:54,56`, `StudentsPage.tsx:442`
    - **prefer-const** (1 violation): `useParents.ts:174`
  - Document the exact counterexamples found (e.g., `ExamTakingView.tsx:135 — catch (_) {} empty block`, `GlobalAnnouncement.tsx:156 — missing senderProfiles in deps`)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the violations exist)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13, 1.14, 1.15, 1.16, 1.17_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Functional Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (all runtime behavior outside the lint violations):
    - Observe: `catch (_) {}` blocks currently swallow errors silently — application continues running
    - Observe: `useEffect`/`useCallback`/`useMemo` hooks currently execute with existing dep arrays — no crash
    - Observe: `let profilesMap = new Map()` builds the map correctly via `.set()` calls
  - Write a property-based test file at `src/__tests__/eslint-fix-preservation.test.ts` with the following property tests:
    - **Catch block behavior**: For any error thrown inside `sessionStorage` operations, the try/catch structure still swallows the error (no rethrow). A comment does not change `catch` execution semantics.
    - **profilesMap output**: For any array of profile objects, `const profilesMap` built with `.set()` produces identical results to `let profilesMap` built with `.set()`. Property: `∀ profiles[], buildMap(profiles) returns same Map whether declared with let or const`.
    - **queryKey subscription stability**: For any stable `{ schoolId, userId }` pair, adding `queryKey` to the deps array of realtime effects does not cause extra re-subscriptions when the values haven't changed (queryKey is a `const` defined outside the effect — its reference is stable).
  - Verify tests pass on UNFIXED code before any changes are made
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12_

- [x] 3. Fix ESLint violations across 14 files

  - [x] 3.1 Fix `no-empty` violations — add explanatory comments to catch blocks
    - **Pattern A** (`void err` blocks — most common): Replace `catch (err: unknown) { void err; }` with:
      ```typescript
      catch (err: unknown) {
        // intentional — error is shown via mutation onError toast
        void err;
      }
      ```
    - **Pattern B** (fully empty `catch (_) {}` blocks): Replace with:
      ```typescript
      catch (_) {
        // intentional — non-critical operation, failure is safe to ignore
      }
      ```
    - Apply changes to:
      - `src/components/exams/ExamTakingView.tsx` lines 135, 152, 175, 222, 280, 285 → Pattern B (`// intentional — sessionStorage errors are non-fatal`)
      - `src/integrations/supabase/client.ts` lines 80, 104 → convert `/* */` to `//` comment (`// intentional — response body unreadable, skip auth failure detection`)
      - `src/components/class-detail/CreateExamWizard.tsx` line 132 → verify if already has comment; line 197 → Pattern B (`// intentional — toast error already shown by mutation onError`)
      - `src/components/class-detail/ElectronicExamsView.tsx` line 43 → Pattern A (`// intentional — toast error already shown by mutation onError`)
      - `src/pages/AdminClassChatRoomPage.tsx` line 50 → Pattern A
      - `src/pages/AdminConversationsPage.tsx` line 416 → Pattern A
      - `src/pages/AdminConversationDetailPage.tsx` line 146 → Pattern A
      - `src/pages/ClassChatRoomPage.tsx` line 100 → Pattern A
      - `src/pages/ParentConversationsPage.tsx` lines 156, 342 → Pattern A
      - `src/pages/StudentsPage.tsx` line 458 → Pattern A
      - `src/hooks/queries/useStudents.ts` line 313 → verify/add (`// intentional — audit log is non-critical, ignore failures`)
    - **NOTE**: `ExamTakingView.tsx` line 120 already has a correct comment — do NOT modify it
    - _Bug_Condition: `isBugCondition(loc)` where `loc.hasEmptyCatchBlock() AND NOT loc.catchBlock.hasExplanatoryComment()`_
    - _Expected_Behavior: All catch blocks contain a `//` explanatory comment, ESLint `no-empty` reports 0 violations_
    - _Preservation: catch execution semantics are unchanged — adding a comment does not affect runtime error handling (Requirements 3.1, 3.11)_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 Fix `react-hooks/exhaustive-deps` — stable references (add directly to deps)
    - These are stable references (setState, dispatch, queryClient, navigate) that will NOT cause extra re-renders:
      - `src/components/GlobalAnnouncement.tsx` line 156 → add `senderProfiles` to deps array
      - `src/components/QueryStateHandler.tsx` line 66 → add `error` to deps array
      - `src/components/class-detail/CreateExamWizard.tsx` line 101 → replace `existingQuestions.length` with `existingQuestions` (full array reference)
      - `src/components/dashboard/ClassExamsView.tsx` line 117 → add `setCustomOrder` to deps (stable ref from useSessionState)
      - `src/components/dashboard/ClassExamsView.tsx` lines 162, 177 → add `setCustomOrder` inside useCallback deps
      - `src/components/dashboard/ClassExamsView.tsx` line 188 → add `setCustomOrder`, `studentGrades`
      - `src/components/dashboard/ClassExamsView.tsx` line 194 → add `studentGrades`
      - `src/pages/GradesPage.tsx` line 81 → add `setSelectedClassId` (stable ref from useState)
      - `src/pages/GradesPage.tsx` line 99 → add `setSelectedMonthFolder`, `monthFolderKeys`
      - `src/pages/GradesPage.tsx` line 107 → fix logical expression used as dependency — use direct values
      - `src/pages/ClassChatRoomPage.tsx` line 80 → add `navigate` (stable ref from react-router)
      - `src/pages/AdminConversationDetailPage.tsx` line 129 → add `queryClient`, `user?.id`
      - `src/pages/StudentDetailPage.tsx` lines 54, 56 → replace compound logical expressions with direct values as useMemo deps
      - `src/pages/StudentsPage.tsx` line 442 → add `student` (or `student?.id`) to deps array
    - _Bug_Condition: `isBugCondition(loc)` where hook uses external values not in deps array and no suppress comment_
    - _Expected_Behavior: All stable references are included in dependency arrays — no stale closures, 0 `exhaustive-deps` violations_
    - _Preservation: Stable refs do not change between renders, so adding them does not trigger extra effect executions (Requirements 3.2, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9)_
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 2.8, 2.13, 2.14_

  - [x] 3.3 Fix `react-hooks/exhaustive-deps` — mutation objects and complex deps (use eslint-disable with documentation)
    - These involve `.mutate` references that change on every render — use targeted disable comments with clear justification:
      - `src/pages/ClassChatRoomPage.tsx` line 85 — `markRead.mutate` changes reference on each render; add:
        ```typescript
        // eslint-disable-next-line react-hooks/exhaustive-deps
        // markRead.mutate intentionally excluded — object reference changes on every render, resolvedRoomId is the meaningful trigger
        ```
      - `src/pages/AdminConversationDetailPage.tsx` line 135 — `markRead.mutate`; same pattern
      - `src/pages/ParentConversationsPage.tsx` line 138 — `markRead.mutate` and `conversation?.id`; same pattern with comment
    - _Bug_Condition: `isBugCondition(loc)` where mutation object deps are missing and no suppress comment_
    - _Expected_Behavior: Each disabled rule has an explicit documented reason — ESLint `exhaustive-deps` reports 0 violations_
    - _Preservation: Effect trigger conditions remain the same — no change in when effects execute (Requirements 3.4, 3.5, 3.12)_
    - _Requirements: 2.10, 2.11, 2.12_

  - [x] 3.4 Fix `react-hooks/exhaustive-deps` — queryKey in realtime hooks
    - These hooks define `queryKey` as a `const` outside the effect — adding it to deps is safe and will not cause extra re-subscriptions:
      - `src/hooks/queries/useClassChat.ts` lines 57, 136, 209, 304 → add `queryKey` to each effect's deps array
      - `src/hooks/queries/useConversations.ts` line 206 → add `queryKey` to deps array
      - `src/hooks/queries/useElectronicExams.ts` line 382 → add `queryKey` to deps array
    - Verify that `queryKey` is defined as a stable `const` outside each effect before adding it
    - _Bug_Condition: `isBugCondition(loc)` where `queryKey` (defined as const outside effect) is used but not listed in deps_
    - _Expected_Behavior: `queryKey` included in deps — subscriptions re-register only when actual query key values change (Requirements 2.9)_
    - _Preservation: `queryKey` is a const reference — subscriptions only re-register when `schoolId`/`userId`/`roomId` actually change (Requirement 3.3)_
    - _Requirements: 2.9_

  - [x] 3.5 Fix `prefer-const` violation in useParents.ts
    - `src/hooks/queries/useParents.ts` line 174: change `let profilesMap` to `const profilesMap`
    - The map is populated exclusively via `.set()` calls (which mutate the object without reassigning the variable binding) — `const` is semantically correct here
    - _Bug_Condition: `isBugCondition(loc)` where `loc.declaresVariable('let') AND NOT loc.variableIsReassigned()`_
    - _Expected_Behavior: `const profilesMap = new Map<string, any>()` — ESLint `prefer-const` reports 0 violations_
    - _Preservation: `.set()` on a `const` Map works identically to `.set()` on a `let` Map — output is unchanged (Requirement 3.10)_
    - _Requirements: 2.15_

  - [x] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - ESLint Zero Violations
    - **IMPORTANT**: Re-run the SAME ESLint command from task 1 — do NOT write a new test
    - The ESLint scan from task 1 encodes the expected behavior (0 violations for the three rules)
    - Run:
      ```
      npx eslint src --ext .ts,.tsx --rule "no-empty: error" --rule "react-hooks/exhaustive-deps: error" --rule "prefer-const: error"
      ```
    - **EXPECTED OUTCOME**: Test PASSES — 0 violations reported (confirms all bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15_

  - [x] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Functional Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run the preservation test suite: `npx vitest run src/__tests__/eslint-fix-preservation.test.ts`
    - Also run the full TypeScript build to catch any type errors introduced: `npm run build`
    - **EXPECTED OUTCOME**: All preservation tests PASS and build succeeds (confirms no regressions)
    - Confirm that:
      - `catch` block behavior is functionally identical (errors still swallowed where intended)
      - `const profilesMap` produces same Map output as `let profilesMap`
      - realtime subscriptions still only re-register on actual value changes
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12_

- [x] 4. Checkpoint — Ensure all tests pass
  - Run full ESLint scan: `npx eslint src --ext .ts,.tsx` — verify 0 violations for `no-empty`, `react-hooks/exhaustive-deps`, `prefer-const`
  - Run TypeScript build: `npm run build` — verify 0 compile errors
  - Run preservation test suite: `npx vitest run src/__tests__/eslint-fix-preservation.test.ts` — all pass
  - Confirm violation count dropped from 42 to 0 for the three targeted rules
  - Ask the user if any questions arise about specific fix choices (especially the `eslint-disable` decisions in tasks 3.3 and any cases where behavior change was uncertain)
