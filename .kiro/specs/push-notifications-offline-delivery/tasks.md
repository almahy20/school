# Implementation Plan

## Overview

خطة تنفيذ إصلاح الإشعارات الفورية عبر خمسة محاور مترابطة، باستخدام منهجية Bug Condition: استكشاف الخطأ أولاً بالاختبارات، ثم حماية السلوك الصحيح، ثم تطبيق الإصلاح.

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Push Notification Delivery Failure Across Five Axes
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples demonstrating each of the five bug conditions
  - **Scoped PBT Approach**: For deterministic bugs, scope each sub-property to its concrete failing case to ensure reproducibility
  - Test implementations based on Bug Condition `isBugCondition(X)` from design:
    - **Axis 1a**: `X.userDismissedPrompt=true AND X.dismissalStoredInLocalStorage=false` — simulate dismiss action and assert `sessionStorage` is used instead of `localStorage`; expect FAIL (key `push_prompt_dismissed` written to `sessionStorage`, not `push_prompt_dismissed_v1` in `localStorage`)
    - **Axis 1b**: `X.userWantsToChangeSettings=true AND X.settingsPageExists=false` — assert `NotificationSettingsCard` does not exist in `SettingsPage`; expect FAIL
    - **Axis 2**: `X.platform=iOS AND X.displayMode=browser AND X.pwaGuidanceShown=false AND X.userAttemptedSubscription=true` — mock iOS Safari UA + non-standalone + call `subscribeToNotifications()` and assert no `IOSPwaGuideModal` is shown; expect FAIL
    - **Axis 3**: `X.platform=Android AND X.permissionJustGranted=true AND X.batteryGuidanceShown=false` — mock Android UA + simulate `permission='granted'` + assert `AndroidBatteryGuideSheet` is not shown; expect FAIL
    - **Axis 4**: `X.notificationSent=true AND X.sentCount=0 AND X.hasActiveSubscription=false AND X.deliveryStatusDisplayedToSender=false` — assert `DeliveryStatusBadge` component does not exist or `useDeliveryStatus` hook not used in message UI; expect FAIL
    - **Axis 5**: `X.permissionStatus='granted' AND X.browserSubscription=null AND X.autoResubscribeAttempted=false` — mock `Notification.permission='granted'` + `getSubscription()` returns `null` + call `checkSubscription()` and assert `pushManager.subscribe()` is NOT called on unfixed code; expect FAIL
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct — it proves all five bugs exist)
  - Document counterexamples found to understand root cause of each axis
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Correct Push Notification Behaviors Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (`NOT isBugCondition(X)`):
    - Observe: `subscribeToNotifications()` succeeds when `permission='default'` → granted, VAPID correct, non-iOS
    - Observe: `checkSubscription()` detects VAPID key mismatch and calls `subscribe()` with new key
    - Observe: Edge Function 3-strike rule: increments `failure_count` on 403, deletes on 3rd strike
    - Observe: Edge Function instantly deletes endpoint on 404/410
    - Observe: Service Worker push event displays notification with RTL, urgency, requireInteraction
    - Observe: `RealtimeNotificationsManager` shows in-app notifications when app is in foreground
  - Write property-based tests covering the Preservation Requirements from design (Req 3.1–3.7):
    - For all VAPID key mismatches: `checkSubscription` calls `unsubscribe()` + `subscribe()` with new key → `isSubscribed=true`
    - For all 410/404 responses in Edge Function: endpoint deleted from `push_subscriptions`
    - For all 403 responses × 3: endpoint deleted after exactly 3 consecutive failures
    - For all transient failures (no status code): subscription kept, `transientFailures` incremented
    - For all valid subscriptions: `subscribeToNotifications` happy path unchanged (saves to DB, `isSubscribed=true`, toast shown)
  - Verify tests PASS on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. Fix Axis 1 — Persistent prompt dismissal and notification settings card

  - [x] 3.1 Migrate `PushNotificationPrompt` from `sessionStorage` to `localStorage`
    - Replace `sessionStorage.setItem('push_prompt_dismissed', 'true')` with `localStorage.setItem('push_prompt_dismissed_v1', 'true')`
    - Replace `sessionStorage.getItem('push_prompt_dismissed') === 'true'` with `localStorage.getItem('push_prompt_dismissed_v1') === 'true'`
    - Update the dismiss handler `handleDismiss` and the mount effect accordingly
    - _Bug_Condition: `X.userDismissedPrompt=true AND X.dismissalStoredInLocalStorage=false` (isBugCondition Axis 1a)_
    - _Expected_Behavior: `result.dismissalStoredInLocalStorage=true` — dismissal persists across browser sessions_
    - _Preservation: subscribeToNotifications happy path and prompt appearance on `permission='default'` remain unchanged (Req 3.1)_
    - _Requirements: 2.1_

  - [x] 3.2 Create `NotificationSettingsCard` component
    - Create `src/components/NotificationSettingsCard.tsx`
    - Accept props: `{ permission: NotificationPermission, isSubscribed: boolean, onSubscribe: () => Promise<boolean>, onUnsubscribe: () => Promise<void> }`
    - Implement 4-state display matrix:
      - `granted + subscribed` → ✓ "مفعّلة" badge + "تعطيل" button
      - `granted + unsubscribed` → ⚠ "يجب إعادة التسجيل" + "تفعيل" button
      - `default` → ○ "غير مفعّلة" + "تفعيل الآن" button
      - `denied` → ✗ "محظورة" + `detectBrowser()`-based unblock instructions (Chrome / Safari / Firefox / other)
    - Add `detectBrowser()` inline helper using `navigator.userAgent`
    - _Bug_Condition: `X.userWantsToChangeSettings=true AND X.settingsPageExists=false` (isBugCondition Axis 1b)_
    - _Expected_Behavior: `result.settingsPageRendered=true` — user can view and change notification state_
    - _Preservation: no changes to subscription logic itself (Req 3.1)_
    - _Requirements: 2.2, 2.3_

  - [x] 3.3 Add `unsubscribeFromNotifications` to `usePushNotifications`
    - Add function that calls `subscription.unsubscribe()` + deletes from `push_subscriptions` by endpoint
    - Expose in hook return value alongside existing exports
    - _Requirements: 2.2_

  - [x] 3.4 Integrate `NotificationSettingsCard` into `SettingsPage`
    - Import and render `NotificationSettingsCard` in the notifications section of the settings page
    - Pass `permission`, `isSubscribed`, `subscribeToNotifications`, `unsubscribeFromNotifications` from `usePushNotifications`
    - _Requirements: 2.2, 2.3_

  - [x] 3.5 Verify bug condition exploration test now passes for Axis 1
    - **Property 1: Expected Behavior** - localStorage persistence + settings card rendered
    - **IMPORTANT**: Re-run the SAME test from task 1 (Axis 1a and 1b sub-tests) — do NOT write a new test
    - **EXPECTED OUTCOME**: Tests PASS (confirms Axis 1 bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.6 Verify preservation tests still pass after Axis 1 fix
    - **Property 2: Preservation** - Subscription happy path unaffected
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions from Axis 1 changes)

- [x] 4. Fix Axis 2 — iOS Safari PWA guidance

  - [x] 4.1 Create `useIOSPushGuard` hook
    - Create `src/hooks/useIOSPushGuard.ts`
    - Detect iOS: `/iP(hone|od|ad)/.test(navigator.userAgent)`
    - Detect standalone: `window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true`
    - Return `{ needsIOSGuidance: isIOS && !isStandalone, isIOSPWA: isIOS && isStandalone }`
    - _Bug_Condition: `X.platform=iOS AND X.displayMode=browser AND X.pwaGuidanceShown=false AND X.userAttemptedSubscription=true` (isBugCondition Axis 2)_
    - _Expected_Behavior: `result.pwaGuidanceShown=true AND result.subscriptionAborted=true`_
    - _Requirements: 2.4, 2.5, 2.6_

  - [x] 4.2 Create `IOSPwaGuideModal` component
    - Create `src/components/IOSPwaGuideModal.tsx`
    - Use existing `Dialog` component from `@radix-ui/react-dialog`
    - Show step-by-step Add-to-Home-Screen instructions:
      1. اضغط على زر المشاركة في Safari (أيقونة المربع مع السهم للأعلى)
      2. اختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen)
      3. أعد فتح التطبيق من أيقونته على الشاشة الرئيسية
    - Accept `open: boolean` and `onClose: () => void` props
    - _Requirements: 2.4, 2.6_

  - [x] 4.3 Integrate iOS guard into `subscribeToNotifications`
    - In `usePushNotifications.ts`, call `useIOSPushGuard()` and check `needsIOSGuidance` before calling `pushManager.subscribe()`
    - If `needsIOSGuidance=true`: show `IOSPwaGuideModal`, return `false` (abort subscription attempt)
    - If `isIOSPWA=true`: proceed normally with subscription
    - _Preservation: non-iOS and iOS PWA subscription path unchanged (Req 3.1)_
    - _Requirements: 2.4, 2.5, 2.6_

  - [x] 4.4 Verify bug condition exploration test now passes for Axis 2
    - **Property 1: Expected Behavior** - iOS guidance modal shown, subscription aborted
    - **IMPORTANT**: Re-run the SAME test from task 1 (Axis 2 sub-test) — do NOT write a new test
    - **EXPECTED OUTCOME**: Test PASSES (confirms Axis 2 bug is fixed)
    - _Requirements: 2.4, 2.5, 2.6_

  - [x] 4.5 Verify preservation tests still pass after Axis 2 fix
    - **Property 2: Preservation** - Non-iOS subscription flow unaffected
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions from Axis 2 changes)

- [x] 5. Fix Axis 3 — Android Battery Optimization guidance

  - [x] 5.1 Create `useAndroidBatteryGuide` hook
    - Create `src/hooks/useAndroidBatteryGuide.ts`
    - Detect Android: `/Android/.test(navigator.userAgent)`
    - Key: `battery_guidance_dismissed_v1`
    - Expose `{ showBatteryGuide: boolean, onPermissionGranted: () => void, dismiss: (permanent: boolean) => void }`
    - `onPermissionGranted()`: if Android + key not set → `setShowSheet(true)`
    - `dismiss(permanent)`: if `permanent` → write key to `localStorage`; `setShowSheet(false)`
    - _Bug_Condition: `X.platform=Android AND X.permissionJustGranted=true AND X.batteryGuidanceShown=false` (isBugCondition Axis 3)_
    - _Expected_Behavior: `result.batteryOptimizationGuidanceShown=true`_
    - _Requirements: 2.7, 2.8_

  - [x] 5.2 Create `AndroidBatteryGuideSheet` component
    - Create `src/components/AndroidBatteryGuideSheet.tsx`
    - Use existing `Sheet` component (bottom drawer)
    - Show OEM-specific battery exemption paths:
      - Samsung: الإعدادات → العناية بالجهاز → البطارية → التطبيقات التي لا تنام أبداً
      - Xiaomi/MIUI: الإعدادات → التطبيقات → إدارة التطبيقات → [اسم التطبيق] → توفير البطارية → بلا قيود
      - Huawei/EMUI: الإعدادات → البطارية → تشغيل التطبيق → الإدارة اليدوية
      - عام: الإعدادات → التطبيقات → [اسم التطبيق] → البطارية → غير مقيّد
    - Two buttons: "فهمت، شكراً" (close only) and "لا تسألني مجدداً" (close + persist `battery_guidance_dismissed_v1`)
    - _Requirements: 2.7, 2.8_

  - [x] 5.3 Integrate battery guide into `subscribeToNotifications`
    - In `usePushNotifications.ts`, after confirming `perm === 'granted'`, call `onPermissionGranted()` from `useAndroidBatteryGuide`
    - Render `AndroidBatteryGuideSheet` conditionally based on `showBatteryGuide` in `PushNotificationPrompt` or nearest layout component
    - _Preservation: subscription success path unchanged; toast "تم تفعيل الإشعارات بنجاح!" still fires (Req 3.1)_
    - _Requirements: 2.7, 2.8_

  - [x] 5.4 Verify bug condition exploration test now passes for Axis 3
    - **Property 1: Expected Behavior** - Battery guide shown after Android permission grant
    - **IMPORTANT**: Re-run the SAME test from task 1 (Axis 3 sub-test) — do NOT write a new test
    - **EXPECTED OUTCOME**: Test PASSES (confirms Axis 3 bug is fixed)
    - _Requirements: 2.7, 2.8_

  - [x] 5.5 Verify preservation tests still pass after Axis 3 fix
    - **Property 2: Preservation** - Non-Android and already-dismissed flows unaffected
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions from Axis 3 changes)

- [ ] 6. Fix Axis 4 — Delivery status persistence and UI badge

  - [x] 6.1 Create database migration for `notification_delivery_logs`
    - Create `supabase/migrations/20260822000000_add_notification_delivery_logs.sql`
    - Table schema: `id uuid PK`, `notification_id uuid FK → notifications(id) CASCADE DELETE`, `sent_count integer`, `total_subscriptions integer`, `has_active_subscription boolean`, `no_device_registered boolean`, `temporary_outage boolean`, `delivered_at timestamptz`, `raw_response jsonb`
    - Enable RLS; add policy `privileged_read_delivery_logs` (admin/teacher via join with `user_roles`)
    - Add policy `service_insert_delivery_logs` (`auth.role() = 'service_role'`)
    - Add index on `notification_id`
    - _Bug_Condition: `X.notificationSent=true AND X.sentCount=0 AND X.hasActiveSubscription=false AND X.deliveryStatusDisplayedToSender=false` (isBugCondition Axis 4)_
    - _Expected_Behavior: `result.senderNotifiedOfNoSubscription=true` — delivery result persisted and visible_
    - _Requirements: 2.9_

  - [x] 6.2 Update Edge Function to write delivery logs
    - In `supabase/functions/send-push-notification/index.ts`, after `console.log` delivery summary and before `return jsonResponse`
    - If `notification_id` is present in request body, insert row into `notification_delivery_logs` with `{ notification_id, sent_count: sent, total_subscriptions: total, has_active_subscription, no_device_registered: noActiveSubscriptionsAtAll, temporary_outage: allAttemptsFailedTemporarily, raw_response: responseBody }`
    - Wrap in try/catch — failure is non-fatal (`console.warn` only), HTTP response unchanged
    - _Preservation: Edge Function delivery logic, VAPID handling, 3-strike rule, TTL/urgency headers all unchanged (Req 3.4, 3.6)_
    - _Requirements: 2.9_

  - [x] 6.3 Create `useDeliveryStatus` hook
    - Create `src/hooks/useDeliveryStatus.ts`
    - Use `useQuery` from `@tanstack/react-query`
    - Query `notification_delivery_logs` where `notification_id = notificationId` via `supabase.from(...).select(...).maybeSingle()`
    - `staleTime: 1000 * 60 * 5` (5 minutes)
    - Return `null` when `notificationId` is null/undefined (disabled query)
    - _Requirements: 2.10_

  - [x] 6.4 Create `DeliveryStatusBadge` component
    - Create `src/components/DeliveryStatusBadge.tsx`
    - Props: `{ notificationId: string, isPrivileged: boolean }`
    - Use `useDeliveryStatus(notificationId)` internally
    - Badge visibility rule (pure function of status):
      - Show badge ⟺ `isPrivileged=true AND no_device_registered=true AND has_active_subscription=false AND temporary_outage=false`
      - No badge for: loading state, `temporary_outage=true`, `sent_count > 0`, `isPrivileged=false`
    - Badge text: "لم يفعّل المستلم الإشعارات"
    - _Requirements: 2.10, 2.11_

  - [x] 6.5 Integrate `DeliveryStatusBadge` into message UI for admin/teacher roles
    - Add `DeliveryStatusBadge` next to sent messages in `ClassMessagesView.tsx`
    - Pass `notificationId` (from message row) and `isPrivileged` (from user role context)
    - _Preservation: existing message display and realtime updates unaffected (Req 3.7)_
    - _Requirements: 2.10, 2.11_

  - [ ] 6.6 Verify bug condition exploration test now passes for Axis 4
    - **Property 1: Expected Behavior** - Delivery status badge shown when no_device_registered
    - **IMPORTANT**: Re-run the SAME test from task 1 (Axis 4 sub-test) — do NOT write a new test
    - **EXPECTED OUTCOME**: Test PASSES (confirms Axis 4 bug is fixed)
    - _Requirements: 2.9, 2.10, 2.11_

  - [ ] 6.7 Verify preservation tests still pass after Axis 4 fix
    - **Property 2: Preservation** - Edge Function delivery behavior and 3-strike rule unaffected
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions from Axis 4 changes)

- [ ] 7. Fix Axis 5 — Proactive re-registration for expired subscriptions

  - [ ] 7.1 Extend `checkSubscription` with proactive re-registration branch
    - In `src/hooks/usePushNotifications.ts`, in `checkSubscription`, extend Case 2 (subscription is null):
    - Before existing `setIsSubscribed(false); return;` — check `Notification.permission === 'granted' && VAPID_PUBLIC_KEY`
    - If true: call `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) })`
    - On success: `saveSubscriptionToDb(user.id, newSub)` + `setIsSubscribed(saved)` + `logger.log('[Push] Proactive re-registration succeeded')`
    - On failure: `logger.warn('[Push] Proactive re-registration failed (silent):', err)` + `setIsSubscribed(false)` — no toast, no user-visible error
    - Return after this branch regardless of outcome
    - _Bug_Condition: `X.permissionStatus='granted' AND X.browserSubscription=null AND X.autoResubscribeAttempted=false` (isBugCondition Axis 5)_
    - _Expected_Behavior: `result.autoResubscribeAttempted=true` — new endpoint saved to DB, `isSubscribed=true`_
    - _Preservation: VAPID key mismatch path (Case 3) unchanged — proactive re-registration only triggers when sub is null AND permission is granted (Req 3.3)_
    - _Requirements: 2.12, 2.13, 2.14_

  - [ ] 7.2 Verify bug condition exploration test now passes for Axis 5
    - **Property 1: Expected Behavior** - Proactive re-registration attempted when granted+null
    - **IMPORTANT**: Re-run the SAME test from task 1 (Axis 5 sub-test) — do NOT write a new test
    - The test from task 1 encodes the expected behavior: `pushManager.subscribe()` must be called when `permission='granted'` and `getSubscription()=null`
    - **EXPECTED OUTCOME**: Test PASSES (confirms Axis 5 bug is fixed)
    - _Requirements: 2.12, 2.13, 2.14_

  - [ ] 7.3 Verify preservation tests still pass after Axis 5 fix
    - **Property 2: Preservation** - VAPID mismatch auto-resubscribe path unchanged; subscription null+not-granted still sets `isSubscribed=false` only
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions from Axis 5 changes)

- [ ] 8. Checkpoint — Ensure all tests pass
  - Run full test suite: `npx vitest --run`
  - Verify all Property 1 (Bug Condition) sub-tests pass — confirms all 5 axes fixed
  - Verify all Property 2 (Preservation) sub-tests pass — confirms no regressions
  - Verify all unit tests for new components pass:
    - `PushNotificationPrompt` — localStorage migration tests
    - `NotificationSettingsCard` — all 4 state variants
    - `usePushNotifications` — proactive re-registration (3 scenarios: success, failure, VAPID mismatch unchanged)
    - `useIOSPushGuard` — iOS non-standalone, iOS standalone, non-iOS
    - `AndroidBatteryGuideSheet` — shown on Android grant, hidden after permanent dismiss, hidden if key already set
    - `DeliveryStatusBadge` — all badge visibility rules
  - Ensure all tests pass; ask the user if any questions arise.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2"] },
    { "wave": 3, "tasks": ["3", "4", "5", "6", "7"] },
    { "wave": 4, "tasks": ["8"] }
  ]
}
```

Tasks 3–7 can be implemented in parallel after tasks 1 and 2 are complete. Task 8 is the final gate requiring all previous tasks to pass.

## Notes

- All property-based tests use `@fast-check/vitest` (minimum 100 iterations per property).
- Tasks 1 and 2 MUST be completed and verified on UNFIXED code before any implementation begins.
- Each axis fix includes its own verification sub-tasks (re-running tasks 1 and 2 for that axis).
- The `notification_delivery_logs` migration (task 6.1) must be applied to Supabase before running task 6.2 tests.
- iOS and Android guidance components use only existing UI primitives (`Dialog`, `Sheet`) — no new dependencies required.
- localStorage keys are versioned (`_v1`) to avoid conflicts with legacy sessionStorage keys.
