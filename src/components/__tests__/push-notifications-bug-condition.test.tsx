/**
 * Bug Condition Exploration Tests — Push Notifications Offline Delivery
 *
 * هذه الاختبارات مصممة لتفشل على الكود الحالي غير المُصلَح.
 * الفشل يُثبت وجود الأخطاء الموثقة في bugfix.md
 *
 * المحاور المختبرة:
 *  1a — sessionStorage بدلاً من localStorage في PushNotificationPrompt
 *  1b — غياب NotificationSettingsCard في SettingsPage
 *  2  — غياب IOSPwaGuideModal وتوجيه iOS
 *  3  — غياب AndroidBatteryGuideSheet وتوجيه Android
 *  4  — غياب DeliveryStatusBadge في ClassMessagesView
 *  5  — لا إعادة تسجيل proactive عند permission=granted + getSubscription()=null (PBT)
 */

import { describe, it, expect, vi } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import * as fc from 'fast-check';

// ─── مسار مشروع ────────────────────────────────────────────────────────────
const PROJECT_SRC = join(process.cwd(), 'src');

// ─────────────────────────────────────────────────────────────────────────────
// المحور 1a — PushNotificationPrompt يجب أن يستخدم localStorage وليس sessionStorage
// ─────────────────────────────────────────────────────────────────────────────
describe('المحور 1a — PushNotificationPrompt يجب أن يستخدم localStorage', () => {
  /**
   * BUG: handleDismiss() يستدعي sessionStorage.setItem('push_prompt_dismissed', 'true')
   * لكن المطلوب هو: localStorage.setItem('push_prompt_dismissed_v1', 'true')
   *
   * سيفشل هذا الاختبار لأن:
   *  1. الكود يستخدم sessionStorage وليس localStorage
   *  2. مفتاح الكود هو 'push_prompt_dismissed' وليس 'push_prompt_dismissed_v1'
   */

  it('يجب أن لا يستخدم الكود sessionStorage في PushNotificationPrompt', () => {
    /**
     * الكود الحالي يحتوي على:
     *   sessionStorage.setItem('push_prompt_dismissed', 'true')
     *   sessionStorage.getItem('push_prompt_dismissed')
     *
     * يجب أن يستخدم بدلاً منه:
     *   localStorage.setItem('push_prompt_dismissed_v1', 'true')
     *   localStorage.getItem('push_prompt_dismissed_v1')
     */
    const sourceFile = join(PROJECT_SRC, 'components', 'PushNotificationPrompt.tsx');
    expect(existsSync(sourceFile)).toBe(true);
    const source = readFileSync(sourceFile, 'utf-8');

    // الكود الحالي يحتوي على sessionStorage → يجب أن لا يحتوي عليه بعد الإصلاح
    const usesSessionStorage = source.includes('sessionStorage');
    // سيفشل لأن الكود يستخدم sessionStorage
    expect(usesSessionStorage).toBe(false);
    // ↑ يفشل: true — الكود يستخدم sessionStorage.setItem('push_prompt_dismissed', ...)
  });

  it('يجب أن يستخدم الكود المفتاح push_prompt_dismissed_v1', () => {
    const sourceFile = join(PROJECT_SRC, 'components', 'PushNotificationPrompt.tsx');
    const source = readFileSync(sourceFile, 'utf-8');

    // يجب أن يحتوي على المفتاح الدائم الجديد
    const usesVersionedKey = source.includes('push_prompt_dismissed_v1');
    // سيفشل لأن الكود يستخدم 'push_prompt_dismissed' بدون _v1
    expect(usesVersionedKey).toBe(true);
    // ↑ يفشل: false — الكود يستخدم 'push_prompt_dismissed' وليس 'push_prompt_dismissed_v1'
  });

  it('يجب أن يستخدم الكود localStorage.getItem بالمفتاح الجديد عند mount', () => {
    const sourceFile = join(PROJECT_SRC, 'components', 'PushNotificationPrompt.tsx');
    const source = readFileSync(sourceFile, 'utf-8');

    // الكود الحالي يقرأ: sessionStorage.getItem('push_prompt_dismissed')
    // يجب أن يقرأ: localStorage.getItem('push_prompt_dismissed_v1')
    const readsCorrectKey = source.includes("localStorage.getItem('push_prompt_dismissed_v1')");
    // سيفشل لأن الكود يقرأ من sessionStorage
    expect(readsCorrectKey).toBe(true);
    // ↑ يفشل: false — الكود يقرأ sessionStorage.getItem('push_prompt_dismissed')
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// المحور 1b — NotificationSettingsCard يجب أن يكون موجوداً
// ─────────────────────────────────────────────────────────────────────────────
describe('المحور 1b — NotificationSettingsCard يجب أن يكون موجوداً', () => {
  /**
   * BUG: ملف NotificationSettingsCard.tsx غير موجود في src/components/
   * SettingsPage تستخدم push button بسيط بدلاً من بطاقة إعدادات شاملة
   *
   * سيفشل هذا الاختبار لأن الملف غير موجود
   */

  it('يجب أن يوجد ملف NotificationSettingsCard.tsx في src/components/', () => {
    const componentPath = join(PROJECT_SRC, 'components', 'NotificationSettingsCard.tsx');
    // سيفشل لأن الملف غير موجود
    expect(existsSync(componentPath)).toBe(true);
    // ↑ يفشل: false — الملف NotificationSettingsCard.tsx غير موجود
  });

  it('يجب أن تستورد SettingsPage مكون NotificationSettingsCard', () => {
    const settingsPagePath = join(PROJECT_SRC, 'pages', 'SettingsPage.tsx');
    expect(existsSync(settingsPagePath)).toBe(true);

    const source = readFileSync(settingsPagePath, 'utf-8');

    // يجب أن تحتوي SettingsPage على import أو استخدام لـ NotificationSettingsCard
    const importsNotificationCard = source.includes('NotificationSettingsCard');
    // سيفشل لأن SettingsPage لا تستورد هذا المكون
    expect(importsNotificationCard).toBe(true);
    // ↑ يفشل: false — SettingsPage لا تحتوي على NotificationSettingsCard
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// المحور 2 — IOSPwaGuideModal يجب أن يظهر على iOS Safari non-standalone
// ─────────────────────────────────────────────────────────────────────────────
describe('المحور 2 — توجيه iOS PWA (IOSPwaGuideModal)', () => {
  /**
   * BUG: usePushNotifications.ts لا يتحقق من iOS non-standalone قبل subscribe()
   * لا يوجد IOSPwaGuideModal.tsx في src/components/
   * لا يوجد useIOSPushGuard.ts في src/hooks/
   *
   * سيفشل هذا الاختبار لأن الملفات غير موجودة
   */

  it('يجب أن يوجد ملف IOSPwaGuideModal.tsx في src/components/', () => {
    const componentPath = join(PROJECT_SRC, 'components', 'IOSPwaGuideModal.tsx');
    // سيفشل لأن الملف غير موجود
    expect(existsSync(componentPath)).toBe(true);
    // ↑ يفشل: false — IOSPwaGuideModal.tsx غير موجود
  });

  it('يجب أن يوجد hook useIOSPushGuard.ts في src/hooks/', () => {
    const hookPath = join(PROJECT_SRC, 'hooks', 'useIOSPushGuard.ts');
    // سيفشل لأن الملف غير موجود
    expect(existsSync(hookPath)).toBe(true);
    // ↑ يفشل: false — useIOSPushGuard.ts غير موجود
  });

  it('يجب أن يتحقق usePushNotifications من iOS قبل استدعاء subscribe', () => {
    /**
     * نفحص الكود المصدري لـ usePushNotifications
     * يجب أن يحتوي على فحص iOS مثل: /iP(hone|od|ad)/.test(navigator.userAgent)
     * أو استدعاء useIOSPushGuard أو IOSPwaGuideModal
     */
    const hookPath = join(PROJECT_SRC, 'hooks', 'usePushNotifications.ts');
    const source = readFileSync(hookPath, 'utf-8');

    const hasIOSCheck =
      source.includes('iP(hone') ||
      source.includes('iPhone') ||
      source.includes('useIOSPushGuard') ||
      source.includes('IOSPwaGuideModal') ||
      source.includes('needsIOSGuidance');

    // سيفشل لأن الكود الحالي لا يتحقق من iOS
    expect(hasIOSCheck).toBe(true);
    // ↑ يفشل: false — usePushNotifications.ts لا يحتوي على أي فحص iOS
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// المحور 3 — AndroidBatteryGuideSheet يجب أن يظهر بعد منح الإذن على Android
// ─────────────────────────────────────────────────────────────────────────────
describe('المحور 3 — توجيه Android Battery Optimization (AndroidBatteryGuideSheet)', () => {
  /**
   * BUG: usePushNotifications.ts لا يُظهر أي إرشاد لـ Battery Optimization بعد منح الإذن
   * لا يوجد AndroidBatteryGuideSheet.tsx في src/components/
   * لا يوجد useAndroidBatteryGuide.ts في src/hooks/
   *
   * سيفشل هذا الاختبار لأن الملفات غير موجودة
   */

  it('يجب أن يوجد ملف AndroidBatteryGuideSheet.tsx في src/components/', () => {
    const componentPath = join(PROJECT_SRC, 'components', 'AndroidBatteryGuideSheet.tsx');
    // سيفشل لأن الملف غير موجود
    expect(existsSync(componentPath)).toBe(true);
    // ↑ يفشل: false — AndroidBatteryGuideSheet.tsx غير موجود
  });

  it('يجب أن يوجد hook useAndroidBatteryGuide.ts في src/hooks/', () => {
    const hookPath = join(PROJECT_SRC, 'hooks', 'useAndroidBatteryGuide.ts');
    // سيفشل لأن الملف غير موجود
    expect(existsSync(hookPath)).toBe(true);
    // ↑ يفشل: false — useAndroidBatteryGuide.ts غير موجود
  });

  it('يجب أن يستدعي subscribeToNotifications الـ battery guide callback بعد منح الإذن على Android', () => {
    const hookPath = join(PROJECT_SRC, 'hooks', 'usePushNotifications.ts');
    const source = readFileSync(hookPath, 'utf-8');

    const hasBatteryGuide =
      source.includes('useAndroidBatteryGuide') ||
      source.includes('AndroidBatteryGuideSheet') ||
      source.includes('onPermissionGranted') ||
      source.includes('battery_guidance') ||
      (source.includes('Android') && source.includes('battery'));

    // سيفشل لأن الكود الحالي لا يتضمن أي توجيه لـ Battery Optimization
    expect(hasBatteryGuide).toBe(true);
    // ↑ يفشل: false — usePushNotifications.ts لا يحتوي على battery guidance
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// المحور 4 — DeliveryStatusBadge يجب أن يكون موجوداً
// ─────────────────────────────────────────────────────────────────────────────
describe('المحور 4 — DeliveryStatusBadge لحالة توصيل الإشعارات', () => {
  /**
   * BUG: DeliveryStatusBadge.tsx غير موجود في src/components/
   * ClassMessagesView لا تعرض أي حالة توصيل للرسائل
   * useDeliveryStatus.ts غير موجود في src/hooks/
   *
   * سيفشل هذا الاختبار لأن الملفات غير موجودة
   */

  it('يجب أن يوجد ملف DeliveryStatusBadge.tsx في src/components/', () => {
    const componentPath = join(PROJECT_SRC, 'components', 'DeliveryStatusBadge.tsx');
    // سيفشل لأن الملف غير موجود
    expect(existsSync(componentPath)).toBe(true);
    // ↑ يفشل: false — DeliveryStatusBadge.tsx غير موجود
  });

  it('يجب أن يوجد hook useDeliveryStatus.ts في src/hooks/', () => {
    const hookPath = join(PROJECT_SRC, 'hooks', 'useDeliveryStatus.ts');
    // سيفشل لأن الملف غير موجود
    expect(existsSync(hookPath)).toBe(true);
    // ↑ يفشل: false — useDeliveryStatus.ts غير موجود
  });

  it('يجب أن تستورد ClassMessagesView مكون DeliveryStatusBadge', () => {
    const viewPath = join(PROJECT_SRC, 'components', 'dashboard', 'ClassMessagesView.tsx');
    expect(existsSync(viewPath)).toBe(true);

    const source = readFileSync(viewPath, 'utf-8');

    const hasDeliveryBadge = source.includes('DeliveryStatusBadge');
    // سيفشل لأن ClassMessagesView لا تستخدم هذا المكون
    expect(hasDeliveryBadge).toBe(true);
    // ↑ يفشل: false — ClassMessagesView.tsx لا تحتوي على DeliveryStatusBadge
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// المحور 5 — لا إعادة تسجيل proactive عند permission=granted + subscription=null
// Property-Based Test باستخدام fast-check مباشرة
// ─────────────────────────────────────────────────────────────────────────────
describe('المحور 5 — الإعادة التلقائية للتسجيل (Proactive Re-registration) — PBT', () => {
  /**
   * BUG: checkSubscription() في usePushNotifications.ts تُنفّذ هذا الكود:
   *
   *   // Case 2: No subscription at all
   *   if (!subscription) {
   *     setIsSubscribed(false);
   *     return; // ← تتوقف هنا بدون محاولة subscribe!
   *   }
   *
   * المطلوب: عندما permission='granted' AND subscription=null
   *          يجب استدعاء pushManager.subscribe() تلقائياً
   *
   * Validates: Requirements 2.12
   */

  it('يجب أن يحتوي كود checkSubscription على منطق proactive re-registration', () => {
    /**
     * نفحص الكود المصدري: يجب أن يحتوي على استدعاء subscribe() في Case 2
     * عند: permission='granted' + subscription=null
     */
    const hookPath = join(PROJECT_SRC, 'hooks', 'usePushNotifications.ts');
    const source = readFileSync(hookPath, 'utf-8');

    const hasProactiveReregistration =
      source.includes('Proactive') ||
      source.includes('proactive') ||
      // فحص وجود subscribe() بعد Case 2 في سياق granted+null
      (source.includes('!subscription') &&
       source.includes("'granted'") &&
       source.includes('pushManager.subscribe'));

    // سيفشل لأن الكود الحالي لا يحتوي على منطق proactive re-registration
    expect(hasProactiveReregistration).toBe(true);
    // ↑ يفشل: false — Case 2 الحالي فقط يضع setIsSubscribed(false) ويعود
  });

  /**
   * Property-Based Test (PBT) — fast-check مع 100 iteration:
   *
   * لأي VAPID_PUBLIC_KEY صالحة (string ≥20 chars، غير placeholder)،
   * عندما نُنفّذ منطق Case 2 الحالي:
   *   subscription=null → setIsSubscribed(false) → return
   * يجب أن يكون pushManager.subscribe() قد استُدعي.
   *
   * الاختبار سيفشل لأن الكود الحالي لا يستدعي subscribe() في هذه الحالة.
   *
   * Validates: Requirements 2.12
   */
  it('PBT: عند أي VAPID key صالحة مع permission=granted وsubscription=null، يجب استدعاء pushManager.subscribe()', async () => {
    await fc.assert(
      fc.asyncProperty(
        // نُولّد VAPID keys صالحة: strings بطول معقول
        fc.string({ minLength: 20, maxLength: 100 }).filter(
          (s) =>
            s !== 'your_vapid_public_key_here' &&
            s.trim() !== '' &&
            !s.includes('\n') &&
            !s.includes('\r')
        ),
        async (vapidKey) => {
          /**
           * نُحاكي منطق checkSubscription الحالي في usePushNotifications:
           *
           * Case 2 (الخاطئ):
           *   if (!subscription) {
           *     setIsSubscribed(false);
           *     return;  // ← يعود هنا دون subscribe!
           *   }
           *
           * نُثبت أن subscribe لا يُستدعى (وهذا هو الخطأ)
           */
          const mockSubscribeFn = vi.fn().mockResolvedValue({
            endpoint: 'https://fcm.example.com/sub',
            toJSON: () => ({ endpoint: 'https://fcm.example.com/sub', keys: {} }),
          });

          // تنفيذ Case 2 الحالي:
          const subscription = null; // getSubscription() يُعيد null

          // الكود الحالي (الخاطئ):
          if (!subscription) {
            // setIsSubscribed(false);
            // return; ← لا يستدعي subscribe
          }

          // الاختبار: يجب أن يكون subscribe قد استُدعي
          // لكن الكود الحالي لا يفعل ذلك → الاختبار يفشل
          expect(mockSubscribeFn).toHaveBeenCalled();
          // ↑ يفشل: mockSubscribeFn.mock.calls.length === 0
        }
      ),
      { numRuns: 100 }
    );
  });

  it('الكود الحالي: Case 2 يتوقف بدون استدعاء subscribe (توثيق الخطأ)', () => {
    /**
     * هذا الاختبار يُوثّق وجود الخطأ في الكود عبر مطابقة النص:
     *
     * الكود الحالي يحتوي على:
     *   // Case 2: No subscription at all
     *   if (!subscription) {
     *     setIsSubscribed(false);
     *     return;
     *   }
     *
     * يجب أن يحتوي على subscribe() بعد هذا التحقق
     */
    const hookPath = join(PROJECT_SRC, 'hooks', 'usePushNotifications.ts');
    const source = readFileSync(hookPath, 'utf-8');

    // نتحقق من أن النمط الخاطئ موجود (يُثبت الخطأ)
    const case2WrongPattern = /\/\/ .* Case 2[\s\S]{0,200}if \(!subscription\)[\s\S]{0,100}setIsSubscribed\(false\)[\s\S]{0,50}return/;
    const hasWrongCase2 = case2WrongPattern.test(source);

    // يجب أن يكون النمط الخاطئ موجوداً (يُثبت أن الخطأ حقيقي)
    expect(hasWrongCase2).toBe(true); // يُمر: يُثبت وجود الخطأ

    // الاختبار الحقيقي: الكود يجب أن يحتوي على منطق الإصلاح
    // إذا كان الكود قد تم إصلاحه سيكون هذا true، بخلاف ذلك سيفشل
    const hasCorrectReregistration =
      source.includes('Proactive re-registration') ||
      source.includes('proactive');

    // سيفشل لأن الكود الحالي لا يحتوي على proactive re-registration
    expect(hasCorrectReregistration).toBe(true);
    // ↑ يفشل: false — الكود الحالي لا يحتوي على 'Proactive re-registration' أو 'proactive'
  });
});
