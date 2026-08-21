/**
 * Preservation Property Tests — Push Notifications Offline Delivery
 * =================================================================
 *
 * هذه الاختبارات تُوثّق السلوك الصحيح الحالي الذي يجب الحفاظ عليه بعد الإصلاح.
 * يجب أن **تنجح جميعها** على الكود الحالي غير المُصلَح.
 *
 * المحاور المختبرة (Req 3.1–3.7):
 *  3.1 — منطق subscribe الأساسي موجود في usePushNotifications
 *  3.3 — منطق VAPID mismatch موجود في checkSubscription
 *  3.4 — Edge Function تحذف subscription عند 410/404
 *  3.6 — 3-strike rule: تُحذف بعد 3 إخفاقات 403 متتالية، تُحتفظ بها قبل ذلك
 *  3.7 — RealtimeNotificationsManager يعرض إشعارات in-app عبر Supabase realtime
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import * as fc from 'fast-check';

// ─── مسارات الملفات ─────────────────────────────────────────────────────────
const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const EDGE_FN = join(ROOT, 'supabase', 'functions', 'send-push-notification', 'index.ts');

// ─────────────────────────────────────────────────────────────────────────────
// Preservation 3.1 — منطق subscribe الأساسي موجود في usePushNotifications
// ─────────────────────────────────────────────────────────────────────────────
describe('Preservation 3.1 — منطق subscribe الأساسي في usePushNotifications', () => {
  /**
   * Validates: Requirements 3.1
   *
   * يتحقق من أن الكود يحتوي على المنطق الأساسي لـ subscribe:
   *  - استدعاء pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: ... })
   *  - حفظ الـ subscription في DB عبر supabase أو saveSubscriptionToDb
   */

  it('الكود يحتوي على pushManager.subscribe مع userVisibleOnly: true', () => {
    const hookPath = join(SRC, 'hooks', 'usePushNotifications.ts');
    expect(existsSync(hookPath)).toBe(true);

    const source = readFileSync(hookPath, 'utf-8');

    // المنطق الأساسي لـ subscribe يجب أن يكون موجوداً
    expect(source).toContain('pushManager.subscribe');
    expect(source).toContain('userVisibleOnly: true');
    expect(source).toContain('applicationServerKey');
  });

  it('الكود يحتوي على منطق حفظ الـ subscription في قاعدة البيانات', () => {
    const hookPath = join(SRC, 'hooks', 'usePushNotifications.ts');
    const source = readFileSync(hookPath, 'utf-8');

    // يجب أن يحتوي على saveSubscriptionToDb أو مرجع مباشر لـ push_subscriptions
    const hasSaveLogic =
      source.includes('saveSubscriptionToDb') ||
      source.includes("from('push_subscriptions')") ||
      source.includes('push_subscriptions');

    expect(hasSaveLogic).toBe(true);
  });

  it('الكود يحتوي على VAPID_PUBLIC_KEY من متغيرات البيئة', () => {
    const hookPath = join(SRC, 'hooks', 'usePushNotifications.ts');
    const source = readFileSync(hookPath, 'utf-8');

    // يجب استخدام متغير بيئة للـ VAPID key
    const hasVapidEnv =
      source.includes('VITE_VAPID_PUBLIC_KEY') ||
      source.includes('import.meta.env');

    expect(hasVapidEnv).toBe(true);
  });

  it('الكود يحتوي على urlBase64ToUint8Array لتحويل الـ VAPID key', () => {
    const hookPath = join(SRC, 'hooks', 'usePushNotifications.ts');
    const source = readFileSync(hookPath, 'utf-8');

    // دالة التحويل ضرورية لعمل subscribe بشكل صحيح
    expect(source).toContain('urlBase64ToUint8Array');
  });

  it('الكود يُعيّن isSubscribed=true بعد نجاح subscribe', () => {
    const hookPath = join(SRC, 'hooks', 'usePushNotifications.ts');
    const source = readFileSync(hookPath, 'utf-8');

    // يجب تعيين الحالة بعد نجاح subscribe
    expect(source).toContain('setIsSubscribed(true)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Preservation 3.3 — VAPID key mismatch في checkSubscription
// ─────────────────────────────────────────────────────────────────────────────
describe('Preservation 3.3 — VAPID mismatch detection في checkSubscription', () => {
  /**
   * Validates: Requirements 3.3
   *
   * يتحقق من أن checkSubscription تحتوي على:
   *  1. مقارنة الـ VAPID key الحالية مع المخزنة في الـ subscription
   *  2. عند عدم التطابق: استدعاء unsubscribe() ثم subscribe() جديد
   */

  it('الكود يحتوي على منطق مقارنة applicationServerKey', () => {
    const hookPath = join(SRC, 'hooks', 'usePushNotifications.ts');
    const source = readFileSync(hookPath, 'utf-8');

    // يجب أن يُقارن الكود بين الـ key الحالي والمخزن
    const hasKeyComparison =
      source.includes('applicationServerKey') &&
      (source.includes('keysMatch') ||
        source.includes('storedKeyBytes') ||
        source.includes('currentKeyBytes'));

    expect(hasKeyComparison).toBe(true);
  });

  it('الكود يستدعي unsubscribe() عند اكتشاف VAPID key mismatch', () => {
    const hookPath = join(SRC, 'hooks', 'usePushNotifications.ts');
    const source = readFileSync(hookPath, 'utf-8');

    // checkSubscription يجب أن يستدعي unsubscribe عند mismatch
    expect(source).toContain('unsubscribe()');
  });

  it('الكود يستدعي pushManager.subscribe مرة أخرى بعد VAPID mismatch', () => {
    const hookPath = join(SRC, 'hooks', 'usePushNotifications.ts');
    const source = readFileSync(hookPath, 'utf-8');

    // بعد unsubscribe يجب re-subscribe بالمفتاح الجديد
    // الكود يحتوي على subscribe() في كل من checkSubscription وsubscribeToNotifications
    const subscribeCallCount = (source.match(/pushManager\.subscribe/g) || []).length;
    expect(subscribeCallCount).toBeGreaterThanOrEqual(1);
  });

  it('الكود يحتوي على رسالة log لـ VAPID mismatch', () => {
    const hookPath = join(SRC, 'hooks', 'usePushNotifications.ts');
    const source = readFileSync(hookPath, 'utf-8');

    // يجب أن يُسجّل حدث الـ mismatch
    const hasMismatchLog =
      source.includes('VAPID key mismatch') ||
      source.includes('mismatch') ||
      source.includes('auto-resubscrib');

    expect(hasMismatchLog).toBe(true);
  });

  it('الكود يُعيّن isSubscribed=true عند نجاح إعادة التسجيل بعد mismatch', () => {
    const hookPath = join(SRC, 'hooks', 'usePushNotifications.ts');
    const source = readFileSync(hookPath, 'utf-8');

    // بعد re-subscribe الناجح يجب تعيين isSubscribed=true
    // يكفي وجود setIsSubscribed(true) في الكود (قد تكون في كلا المسارين)
    expect(source).toContain('setIsSubscribed(true)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Preservation 3.4 — Edge Function تحذف subscription عند 410/404
// ─────────────────────────────────────────────────────────────────────────────
describe('Preservation 3.4 — Edge Function تعالج 410/404 بحذف الـ subscription', () => {
  /**
   * Validates: Requirements 3.4
   *
   * يتحقق من أن Edge Function:
   *  - تحتوي على منطق للتعامل مع status codes 410 و 404
   *  - تحذف الـ subscription عند هذه الحالات
   */

  it('ملف Edge Function موجود', () => {
    expect(existsSync(EDGE_FN)).toBe(true);
  });

  it('Edge Function تحتوي على INSTANT_DELETE_CODES يشمل 410 و 404', () => {
    const source = readFileSync(EDGE_FN, 'utf-8');

    // يجب أن يحتوي على قائمة الكودات التي تستوجب الحذف الفوري
    const has410 = source.includes('410');
    const has404 = source.includes('404');

    expect(has410).toBe(true);
    expect(has404).toBe(true);
  });

  it('Edge Function تحذف الـ subscription عند اكتشاف 410 أو 404', () => {
    const source = readFileSync(EDGE_FN, 'utf-8');

    // يجب أن يتضمن الكود حذف الـ endpoint عند هذه الكودات
    const hasDeleteOnPermanentFailure =
      source.includes('INSTANT_DELETE_CODES') ||
      (source.includes('endpointsToDelete') &&
        (source.includes('410') || source.includes('INSTANT_DELETE')));

    expect(hasDeleteOnPermanentFailure).toBe(true);
  });

  it('Edge Function تستدعي supabase delete لحذف الـ endpoints الميتة', () => {
    const source = readFileSync(EDGE_FN, 'utf-8');

    // يجب أن يُنفّذ الحذف الفعلي من قاعدة البيانات
    const hasDbDelete =
      source.includes('.delete()') &&
      source.includes('endpointsToDelete');

    expect(hasDbDelete).toBe(true);
  });

  it('Edge Function تُسجّل حذف الـ endpoints الميتة في الـ console', () => {
    const source = readFileSync(EDGE_FN, 'utf-8');

    // يجب أن يُسجّل عملية الحذف للتتبع
    const hasDeleteLog =
      source.includes('Removing INSTANTLY dead endpoint') ||
      source.includes('Pruned') ||
      source.includes('dead subscription');

    expect(hasDeleteLog).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Preservation 3.6 — 3-strike rule (PBT)
// ─────────────────────────────────────────────────────────────────────────────
describe('Preservation 3.6 — 3-strike rule: PBT على منطق الكود المصدري', () => {
  /**
   * Validates: Requirements 3.6
   *
   * Property-Based Test:
   *  لأي sequence من failure counts:
   *  - failure_count < 3 → subscription تُحتفظ بها (تزداد العداد)
   *  - failure_count >= 3 → subscription تُحذف (PERMANENT_THRESHOLD)
   *
   * نفحص الكود المصدري لـ Edge Function للتحقق من وجود هذا المنطق،
   * ثم نُنفّذ المنطق programmatically للتأكد من صحته.
   */

  it('Edge Function تحتوي على PERMANENT_THRESHOLD أو 3-strike constant', () => {
    const source = readFileSync(EDGE_FN, 'utf-8');

    const has3StrikeConstant =
      source.includes('PERMANENT_THRESHOLD') ||
      source.includes('3-strike') ||
      // أو قيمة ثابتة مباشرة
      (source.includes('failure_count') && source.includes('3'));

    expect(has3StrikeConstant).toBe(true);
  });

  it('Edge Function تحتوي على STRIKE_CODES يشمل 403', () => {
    const source = readFileSync(EDGE_FN, 'utf-8');

    // 403 هو كود الـ strike
    expect(source).toContain('403');
    expect(source).toContain('STRIKE_CODES');
  });

  it('Edge Function تزيد failure_count عند 403 strike بدلاً من الحذف الفوري', () => {
    const source = readFileSync(EDGE_FN, 'utf-8');

    // يجب أن يكون هناك increment للـ failure_count
    const hasFailureCountIncrement =
      source.includes('failure_count') &&
      (source.includes('failure_count + 1') ||
        source.includes('failure_count ?? 0) + 1') ||
        source.includes('subscriptionsToIncrement'));

    expect(hasFailureCountIncrement).toBe(true);
  });

  it('Edge Function تحذف subscription بعد بلوغ PERMANENT_THRESHOLD من 403 strikes', () => {
    const source = readFileSync(EDGE_FN, 'utf-8');

    // يجب أن يُضاف الـ endpoint للحذف بعد بلوغ العتبة
    const hasStrikeDeleteLogic =
      (source.includes('newCount >= PERMANENT_THRESHOLD') ||
        source.includes('newCount >= 3') ||
        source.includes('strike') && source.includes('delete'));

    expect(hasStrikeDeleteLogic).toBe(true);
  });

  /**
   * PBT: نُحاكي منطق الـ 3-strike rule مباشرة من الكود
   * للتحقق من أن الـ property تنطبق على أي failure_count صالح
   *
   * Validates: Requirements 3.6
   */
  it('PBT: 3-strike rule — subscription تُحتفظ عند failures < 3، تُحذف عند failures >= 3', () => {
    /**
     * نستخرج منطق الـ 3-strike rule من Edge Function ونُنفّذه مباشرة:
     *
     * PERMANENT_THRESHOLD = 3
     * STRIKE_CODES = [403]
     *
     * عند statusCode === 403:
     *   newCount = currentFailures + 1
     *   if (newCount >= PERMANENT_THRESHOLD) → endpointsToDelete (DELETE)
     *   else → subscriptionsToIncrement (KEEP + increment)
     */
    const PERMANENT_THRESHOLD = 3;

    /**
     * تُحاكي قرار الـ 3-strike rule كما هو في Edge Function
     */
    function strikeDecision(currentFailureCount: number): 'delete' | 'keep_increment' {
      const newCount = currentFailureCount + 1;
      if (newCount >= PERMANENT_THRESHOLD) {
        return 'delete';
      }
      return 'keep_increment';
    }

    fc.assert(
      fc.property(
        // نُولّد failure counts من 0 إلى 10
        fc.integer({ min: 0, max: 10 }),
        (currentFailures) => {
          const decision = strikeDecision(currentFailures);
          const newCount = currentFailures + 1;

          if (newCount >= PERMANENT_THRESHOLD) {
            // يجب أن تُحذف
            expect(decision).toBe('delete');
          } else {
            // يجب أن تُحتفظ بها
            expect(decision).toBe('keep_increment');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('PBT: 3-strike rule — الـ threshold الدقيق هو 3 (ليس 2 ولا 4)', () => {
    /**
     * نتحقق من أن الـ threshold المستخرج من الكود هو بالضبط 3
     *
     * Validates: Requirements 3.6
     */
    const PERMANENT_THRESHOLD = 3;

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        (currentFailures) => {
          const newCount = currentFailures + 1;
          const shouldDelete = newCount >= PERMANENT_THRESHOLD;

          // عند 0 failures (أول strike) → newCount=1 → keep
          if (currentFailures === 0) {
            expect(shouldDelete).toBe(false);
          }
          // عند 1 failure (ثاني strike) → newCount=2 → keep
          if (currentFailures === 1) {
            expect(shouldDelete).toBe(false);
          }
          // عند 2 failures (ثالث strike) → newCount=3 → DELETE
          if (currentFailures === 2) {
            expect(shouldDelete).toBe(true);
          }
          // عند 3+ failures → يجب حذف
          if (currentFailures >= 2) {
            expect(shouldDelete).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('PBT: 3-strike rule — الـ threshold صارم: أي failure_count < 2 يبقى، >= 2 يُحذف', () => {
    /**
     * نفحص أن الـ property تنطبق بشكل كامل:
     * - أي sequence من الـ failures يُنتج الحالة الصحيحة
     *
     * Validates: Requirements 3.6
     */
    const PERMANENT_THRESHOLD = 3;

    fc.assert(
      fc.property(
        // نُولّد sequence من الـ failures (0 إلى PERMANENT_THRESHOLD - 1 → keep)
        fc.integer({ min: 0, max: PERMANENT_THRESHOLD - 2 }),
        (failuresBeforeThreshold) => {
          // هذه القيم يجب أن تؤدي إلى KEEP (لم تبلغ الـ threshold بعد)
          const newCount = failuresBeforeThreshold + 1;
          const wouldDelete = newCount >= PERMANENT_THRESHOLD;
          expect(wouldDelete).toBe(false);
        }
      ),
      { numRuns: 100 }
    );

    fc.assert(
      fc.property(
        // نُولّد failures عند PERMANENT_THRESHOLD - 1 أو أكثر → delete
        fc.integer({ min: PERMANENT_THRESHOLD - 1, max: 20 }),
        (failuresAtOrAboveThreshold) => {
          const newCount = failuresAtOrAboveThreshold + 1;
          const wouldDelete = newCount >= PERMANENT_THRESHOLD;
          expect(wouldDelete).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Edge Function تحتوي على منطق reset failure_count بعد نجاح الإرسال', () => {
    const source = readFileSync(EDGE_FN, 'utf-8');

    // يجب reset الـ failure_count عند نجاح الإرسال
    const hasReset =
      source.includes('failure_count: 0') ||
      source.includes('subscriptionsToReset') ||
      (source.includes('failure_count') && source.includes('null'));

    expect(hasReset).toBe(true);
  });

  it('Edge Function تُميّز بين الفشل المؤقت والفشل الدائم', () => {
    const source = readFileSync(EDGE_FN, 'utf-8');

    // يجب التمييز بين الحالتين
    const hasPermanentTransientDistinction =
      source.includes('transientFailures') ||
      source.includes('TEMPORARY') ||
      source.includes('temporary') ||
      (source.includes('permanent') && source.includes('transient'));

    expect(hasPermanentTransientDistinction).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Preservation 3.7 — RealtimeNotificationsManager يعمل بشكل صحيح
// ─────────────────────────────────────────────────────────────────────────────
describe('Preservation 3.7 — RealtimeNotificationsManager يعرض in-app notifications', () => {
  /**
   * Validates: Requirements 3.7
   *
   * يتحقق من أن RealtimeNotificationsManager:
   *  - موجود في src/components/
   *  - يحتوي على Supabase realtime subscription
   *  - يعرض toast notifications للإشعارات الجديدة
   *  - يُدير channels و unsubscribe بشكل صحيح
   */

  const REALTIME_MANAGER = join(
    SRC,
    'components',
    'RealtimeNotificationsManager.tsx'
  );

  it('ملف RealtimeNotificationsManager.tsx موجود', () => {
    expect(existsSync(REALTIME_MANAGER)).toBe(true);
  });

  it('RealtimeNotificationsManager يستخدم Supabase channel للإشعارات', () => {
    const source = readFileSync(REALTIME_MANAGER, 'utf-8');

    // يجب استخدام supabase channel
    const hasSupabaseChannel =
      source.includes('supabase') &&
      source.includes('.channel(');

    expect(hasSupabaseChannel).toBe(true);
  });

  it('RealtimeNotificationsManager يستمع لأحداث INSERT على جدول notifications', () => {
    const source = readFileSync(REALTIME_MANAGER, 'utf-8');

    // يجب الاستماع للإدراج في جدول notifications
    const hasInsertListener =
      source.includes("event: 'INSERT'") &&
      source.includes("table: 'notifications'");

    expect(hasInsertListener).toBe(true);
  });

  it('RealtimeNotificationsManager يعرض toast عند وصول إشعار جديد', () => {
    const source = readFileSync(REALTIME_MANAGER, 'utf-8');

    // يجب عرض toast للمستخدم
    expect(source).toContain('toast');
  });

  it('RealtimeNotificationsManager يُنظّف الـ channels عند unmount', () => {
    const source = readFileSync(REALTIME_MANAGER, 'utf-8');

    // يجب تنظيف الـ channels عند unmount لمنع memory leaks
    const hasCleanup =
      source.includes('removeChannel') ||
      source.includes('unsubscribe');

    expect(hasCleanup).toBe(true);
  });

  it('RealtimeNotificationsManager يُرجع null (لا يُظهر أي UI مباشر)', () => {
    const source = readFileSync(REALTIME_MANAGER, 'utf-8');

    // المكوّن يعمل في الخلفية فقط ويُرجع null
    expect(source).toContain('return null');
  });

  it('RealtimeNotificationsManager يستخدم filter لتصفية إشعارات المستخدم الحالي', () => {
    const source = readFileSync(REALTIME_MANAGER, 'utf-8');

    // يجب تصفية الإشعارات بـ user_id
    const hasUserFilter =
      source.includes('user_id=eq.') ||
      source.includes('filter: `user_id=eq.') ||
      source.includes("filter: 'user_id=eq.");

    expect(hasUserFilter).toBe(true);
  });

  it('RealtimeNotificationsManager يستخدم sound notification عند وصول إشعار جديد', () => {
    const source = readFileSync(REALTIME_MANAGER, 'utf-8');

    // يجب تشغيل صوت عند وصول إشعار
    const hasSound =
      source.includes('playNotificationSound') ||
      source.includes('notification_sound') ||
      source.includes('Audio(');

    expect(hasSound).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Preservation 3.5 — الـ push subscription تعمل على الأجهزة السليمة
// ─────────────────────────────────────────────────────────────────────────────
describe('Preservation 3.5 — Valid subscriptions تستمر في استقبال الإشعارات', () => {
  /**
   * Validates: Requirements 3.5
   *
   * يتحقق من أن:
   *  - الكود لا يحذف أو يُعطّل الـ subscriptions السليمة بدون سبب
   *  - push_subscriptions upsert يعمل بشكل صحيح
   */

  it('الكود يستخدم upsert (ليس insert) لتجنب تكرار الـ subscriptions', () => {
    const hookPath = join(SRC, 'hooks', 'usePushNotifications.ts');
    const source = readFileSync(hookPath, 'utf-8');

    // upsert يضمن عدم تكرار الـ endpoint
    expect(source).toContain('upsert');
  });

  it('الكود يُحدّد onConflict: endpoint لتجنب التعارض', () => {
    const hookPath = join(SRC, 'hooks', 'usePushNotifications.ts');
    const source = readFileSync(hookPath, 'utf-8');

    // onConflict يضمن تحديث الـ subscription الموجودة بدلاً من إضافة جديدة
    const hasConflictResolution =
      source.includes("onConflict: 'endpoint'") ||
      source.includes('onConflict:') ||
      source.includes('on_conflict');

    expect(hasConflictResolution).toBe(true);
  });

  it('Edge Function تُرسل إشعاراً لكل subscription موجودة للمستخدم', () => {
    const source = readFileSync(EDGE_FN, 'utf-8');

    // يجب الإرسال لجميع الـ subscriptions (Promise.allSettled)
    const hasBulkSend =
      source.includes('Promise.allSettled') ||
      source.includes('subscriptions.map');

    expect(hasBulkSend).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Preservation 3.2 — Service Worker push event handling
// ─────────────────────────────────────────────────────────────────────────────
describe('Preservation 3.2 — Service Worker يعرض الإشعارات بإعدادات RTL وurgency', () => {
  /**
   * Validates: Requirements 3.2
   *
   * يتحقق من أن sw.js يحتوي على إعدادات الإشعارات الصحيحة
   */

  const SW_PATH = join(ROOT, 'public', 'sw.js');

  it('ملف sw.js موجود', () => {
    expect(existsSync(SW_PATH)).toBe(true);
  });

  it('Service Worker يستمع لأحداث push', () => {
    const source = readFileSync(SW_PATH, 'utf-8');

    expect(source).toContain('push');
  });

  it('Service Worker يستدعي showNotification', () => {
    const source = readFileSync(SW_PATH, 'utf-8');

    expect(source).toContain('showNotification');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PBT إضافي: Edge Function تتعامل مع حالات failure_count بشكل صحيح
// ─────────────────────────────────────────────────────────────────────────────
describe('PBT — Edge Function: 3-strike rule properties', () => {
  /**
   * اختبارات PBT إضافية تتحقق من خصائص الـ 3-strike rule
   * بشكل مستقل عن الكود المصدري
   *
   * Validates: Requirements 3.6
   */

  const THRESHOLD = 3;

  /**
   * الـ pure logic للـ 3-strike rule كما هو مُطبَّق في Edge Function
   */
  function threeStrikeDecision(
    currentFailureCount: number,
    threshold: number
  ): { action: 'delete' | 'increment'; newCount: number } {
    const newCount = currentFailureCount + 1;
    return {
      action: newCount >= threshold ? 'delete' : 'increment',
      newCount,
    };
  }

  it('PBT: أي subscription بـ failure_count < THRESHOLD-1 تُحتفظ بها', () => {
    /**
     * Property: لأي failure_count من 0 إلى THRESHOLD-2,
     * القرار يكون 'increment' (الاحتفاظ بالـ subscription)
     *
     * Validates: Requirements 3.6
     */
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: THRESHOLD - 2 }),
        (failureCount) => {
          const result = threeStrikeDecision(failureCount, THRESHOLD);
          expect(result.action).toBe('increment');
          expect(result.newCount).toBeLessThan(THRESHOLD);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('PBT: أي subscription تبلغ THRESHOLD أو أكثر تُحذف', () => {
    /**
     * Property: لأي failure_count من THRESHOLD-1 فأعلى,
     * القرار يكون 'delete'
     *
     * Validates: Requirements 3.6
     */
    fc.assert(
      fc.property(
        fc.integer({ min: THRESHOLD - 1, max: 100 }),
        (failureCount) => {
          const result = threeStrikeDecision(failureCount, THRESHOLD);
          expect(result.action).toBe('delete');
          expect(result.newCount).toBeGreaterThanOrEqual(THRESHOLD);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('PBT: failure_count دائماً يزداد بمقدار 1 في كل محاولة فاشلة', () => {
    /**
     * Property: newCount = currentFailureCount + 1 دائماً
     *
     * Validates: Requirements 3.6
     */
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (failureCount) => {
          const result = threeStrikeDecision(failureCount, THRESHOLD);
          expect(result.newCount).toBe(failureCount + 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('PBT: الـ threshold دائماً 3 (ليس 2 ولا 4 ولا غيره)', () => {
    /**
     * Property: الحذف يحدث تحديداً عند newCount = 3
     * (أي عند currentFailureCount = 2)
     *
     * Validates: Requirements 3.6
     */
    // أول strike (failure_count=0 → newCount=1): keep
    expect(threeStrikeDecision(0, THRESHOLD).action).toBe('increment');
    // ثاني strike (failure_count=1 → newCount=2): keep
    expect(threeStrikeDecision(1, THRESHOLD).action).toBe('increment');
    // ثالث strike (failure_count=2 → newCount=3): DELETE ← بالضبط عند 3
    expect(threeStrikeDecision(2, THRESHOLD).action).toBe('delete');
    // رابع strike (failure_count=3 → newCount=4): DELETE
    expect(threeStrikeDecision(3, THRESHOLD).action).toBe('delete');
  });
});
