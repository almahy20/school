# Implementation Tasks

## Feature: Electronic Exams + Parent Chat

### Task 1: Database Migration ✅
- [x] Create `electronic_exams` table with all required columns and constraints
- [x] Create `exam_questions` table with question types and ordering
- [x] Create `exam_attempts` table with UNIQUE(exam_id, student_id) constraint
- [x] Create `class_chat_rooms` table with UNIQUE(school_id, class_id)
- [x] Create `class_chat_messages` table with 500-char CHECK constraint
- [x] Apply RLS policies for admin/teacher/parent roles on all tables
- [x] Enable Supabase Realtime with REPLICA IDENTITY FULL
- [x] Add performance indexes on all FK and filter columns
- [x] Add `updated_at` trigger for `electronic_exams`
- File: `supabase/migrations/20260827000000_electronic_exams_and_class_chat.sql`

### Task 2: Query Hooks ✅
- [x] `useElectronicExams.ts` — admin hooks: useClassElectronicExams, useExamQuestions, useExamAttempts, useCreateElectronicExam, useUpdateElectronicExam, useDeleteElectronicExam, useSaveExamQuestions
- [x] `useElectronicExams.ts` — parent hooks: useParentElectronicExams (with Realtime), useSubmitExamAttempt
- [x] `useClassChat.ts` — admin hook: useAdminClassChatRooms (with Realtime)
- [x] `useClassChat.ts` — parent hooks: useParentClassChatRooms, useClassChatMessages (with Realtime), useEnsureClassChatRoom, useSendClassChatMessage
- [x] Export all hooks from `hooks/queries/index.ts`

### Task 3: Admin Exam Management UI ✅
- [x] `ElectronicExamsView.tsx` — exam list with stats cards, delete confirmation
- [x] `CreateExamWizard.tsx` — 3-step wizard (info → questions → preview/publish)
  - Step 1: Form validation with zod (title, subject, duration 1–180, optional instructions)
  - Step 2: Question editor for true_false, multiple_choice, fill_blank; add/delete/reorder; 50-question limit
  - Step 3: Preview showing correct answers highlighted; publish button
- [x] `ExamResultsView.tsx` — results table with CSV export, summary stats
- [x] Integrate into `ClassDetailPage.tsx` as new `electronic-exams` ViewMode with violet ActionCard

### Task 4: Parent Exam UI ✅
- [x] `ParentExamsPage.tsx` — exam cards with status badge (new/done), score display, student name
- [x] `ExamTakingView.tsx` — confirm screen → taking screen → result screen
  - Confirm: exam info, student name, question count, duration, instructions
  - Taking: one question at a time, progress bar, countdown timer (red + pulse < 120s), nav dots
  - Auto-submit on timeout with toast notification
  - End confirmation dialog with answered/total count
  - Result: score percentage with color (green/amber/red), detailed correction per question
- [x] Route `/exams` added to `App.tsx` (parent-only)

### Task 5: Parent Chat UI ✅
- [x] Redesigned `ParentConversationsPage.tsx` with two sections:
  - Admin Chat panel (existing conversation system)
  - Class Chat panels (one per child's class)
- [x] Sidebar list on desktop, full-screen panel on mobile
- [x] `AdminChatPanel` — unread badge, auto-create conversation, mark-as-read
- [x] `ClassChatPanel` — 500-char limit with counter, sender name display, Realtime
- [x] `useEnsureClassChatRoom` called with idempotent INSERT ... ON CONFLICT DO NOTHING

### Task 6: Admin Class Chat Monitor ✅
- [x] Added `class-chat` tab to `AdminConversationsPage`
- [x] `ClassChatTab` — room list sidebar + chat panel with correct flex height
- [x] Admin can read all class chat rooms in their school and send replies
- [x] `useAdminClassChatRooms` hook with Realtime subscription

### Task 7: Navigation Updates ✅
- [x] Added `{ to: '/exams', label: 'الاختبارات', icon: ClipboardList }` to `parentLinks` in `Sidebar.tsx`
- [x] Added same entry to `parentLinks` in `BottomNav.tsx` (mobile navigation)
- [x] `conversations` badge still shows unread count on parent nav items

### Task 8: Design & UX ✅
- [x] All exam cards use `rounded-[28px]`, `hover:shadow-md transition-shadow` (Req 11.1)
- [x] Timer turns `text-red-600` + `animate-pulse` when < 120 seconds (Req 11.4)
- [x] Loading/error states use `QueryStateHandler` (Req 11.5)
- [x] Chat errors use `toast.error()` from sonner; loading uses `Loader2 animate-spin` (Req 11.6)
- [x] All components use `dir="rtl"` with RTL-aware spacing (Req 11.3)
- [x] Message bubbles follow existing `ParentConversationsPage` pattern with sender name in class chat (Req 11.2)
