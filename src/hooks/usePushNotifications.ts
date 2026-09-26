import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { logger } from '@/utils/logger';

const isNetworkLikeError = (e: unknown): boolean => {
  if (!e) return false;
  const str = (typeof e === 'string' ? e : (e as any).message || (e as any).details || '').toLowerCase();
  return (
    str.includes('failed to fetch') ||
    str.includes('networkerror') ||
    str.includes('cors') ||
    str.includes('load resource') ||
    str.includes('abort') ||
    str.includes('timeout') ||
    str.includes('gateway timeout') ||
    str.includes('temporarily unavailable')
  );
};

export function usePushNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showBatteryGuide, setShowBatteryGuide] = useState(false);

  const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

  // Guard refs to prevent duplicate subscriptions while offline/CORS-failing
  const dbFailCountRef = useRef(0);
  const lastDbFailTimeRef = useRef(0);
  const DB_FAIL_COOLDOWN_MS = 60_000;
  const DB_MAX_FAILS_BEFORE_COOLDOWN = 3;

// Module-level guard for proactive re-registration (shared across all hook instances)
let _lastProactiveAttemptTime = 0;
let _isProactiveInProgress = false;
const PROACTIVE_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes backoff on failure

  const onBatteryPermissionGranted = useCallback(() => {
    const isAndroid = /Android/.test(navigator.userAgent);
    if (!isAndroid) return;
    if (localStorage.getItem('battery_guidance_dismissed_v1') !== 'true') {
      setShowBatteryGuide(true);
    }
  }, []);

  const dismissBatteryGuide = useCallback((permanent: boolean) => {
    if (permanent) localStorage.setItem('battery_guidance_dismissed_v1', 'true');
    setShowBatteryGuide(false);
  }, []);

  const urlBase64ToUint8Array = useCallback((base64String: string) => {
    const cleaned = base64String.trim().replace(/^"|"$/g, '');
    const padding = '='.repeat((4 - cleaned.length % 4) % 4);
    const base64 = (cleaned + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }, []);

  const shouldSkipDbCalls = (): boolean => {
    const now = Date.now();
    if (
      dbFailCountRef.current >= DB_MAX_FAILS_BEFORE_COOLDOWN &&
      now - lastDbFailTimeRef.current < DB_FAIL_COOLDOWN_MS
    ) {
      return true;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return true;
    }
    return false;
  };

  const recordDbFail = () => {
    dbFailCountRef.current++;
    lastDbFailTimeRef.current = Date.now();
    if (dbFailCountRef.current >= DB_MAX_FAILS_BEFORE_COOLDOWN) {
      logger.warn(
        `[Push] DB calls cooling down for ${DB_FAIL_COOLDOWN_MS / 1000}s after ${dbFailCountRef.current} failures.`
      );
    }
  };

  const recordDbSuccess = () => {
    dbFailCountRef.current = 0;
  };

  const saveSubscriptionToDb = useCallback(async (
    userId: string,
    subscription: PushSubscription
  ): Promise<boolean> => {
    if (shouldSkipDbCalls()) {
      logger.debug('[Push] Skipping saveSubscriptionToDb — DB cooldown active or offline.');
      return false;
    }

    const subJson = subscription.toJSON();
    try {
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
          { 
            user_id: userId, 
            school_id: user?.schoolId || null,
            subscription: subJson, 
            endpoint: subscription.endpoint 
          },
          { onConflict: 'endpoint' }
        );

      if (error) {
        logger.warn('[Push] DB upsert failed:', error);
        // FALLBACK — but NOT if this is a network/CORS error (we'll just make more spam)
        if (isNetworkLikeError(error)) {
          recordDbFail();
          return false;
        }

        recordDbFail();
        try {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', subscription.endpoint);

          const { error: insErr } = await supabase
            .from('push_subscriptions')
            .insert({ user_id: userId, subscription: subJson, endpoint: subscription.endpoint });

          if (insErr) {
            logger.error('[Push] DB fallback insert error:', insErr);
            return false;
          }
        } catch (fallbackErr) {
          if (isNetworkLikeError(fallbackErr)) recordDbFail();
          logger.error('[Push] DB fallback chain error:', fallbackErr);
          return false;
        }
      } else {
        recordDbSuccess();
      }
      return true;
    } catch (e) {
      if (isNetworkLikeError(e)) recordDbFail();
      logger.error('[Push] saveSubscriptionToDb threw:', e);
      return false;
    }
  }, []);

  const checkSubscription = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !user?.id) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      logger.debug('[Push] checkSubscription skipped — offline.');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription && Notification.permission === 'denied') {
        await subscription.unsubscribe();
        setIsSubscribed(false);
        logger.warn('[Push] Subscription cleaned up — permission denied');
        return;
      }

      if (!subscription) {
        const canAttemptProactive =
          Notification.permission === 'granted' &&
          VAPID_PUBLIC_KEY &&
          VAPID_PUBLIC_KEY !== 'your_vapid_public_key_here' &&
          !shouldSkipDbCalls() &&
          !_isProactiveInProgress &&
          Date.now() - _lastProactiveAttemptTime > PROACTIVE_COOLDOWN_MS;

        if (canAttemptProactive) {
          _isProactiveInProgress = true;
          _lastProactiveAttemptTime = Date.now();
          try {
            logger.log('[Push] Proactive re-registration: granted+null → re-subscribing silently');
            const newSub = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });
            const saved = await saveSubscriptionToDb(user.id, newSub);
            setIsSubscribed(saved);
            if (saved) logger.log('[Push] Proactive re-registration succeeded');
          } catch (err) {
            logger.warn('[Push] Proactive re-registration failed (silent):', err);
            setIsSubscribed(false);
          } finally {
            _isProactiveInProgress = false;
          }
        } else {
          setIsSubscribed(false);
        }
        return;
      }

      if (VAPID_PUBLIC_KEY && VAPID_PUBLIC_KEY !== 'your_vapid_public_key_here') {
        try {
          const currentKeyBytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
          const storedKeyBytes = subscription.options?.applicationServerKey
            ? new Uint8Array(subscription.options.applicationServerKey as ArrayBuffer)
            : null;

          const keysMatch =
            storedKeyBytes !== null &&
            storedKeyBytes.length === currentKeyBytes.length &&
            storedKeyBytes.every((byte, i) => byte === currentKeyBytes[i]);

          if (!keysMatch) {
            logger.warn('[Push] VAPID key mismatch — auto-resubscribing with new key...');
            await subscription.unsubscribe();

            if (Notification.permission === 'granted' && !shouldSkipDbCalls()) {
              const newSubscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: currentKeyBytes,
              });
              const saved = await saveSubscriptionToDb(user.id, newSubscription);
              setIsSubscribed(saved);
              if (saved) {
                logger.log('[Push] Auto-resubscribe successful — new endpoint registered');
              }
            } else {
              setIsSubscribed(false);
              logger.warn('[Push] VAPID mismatch but no permission or DB on cooldown — skipping');
            }
            return;
          }
        } catch (keyCheckErr) {
          logger.warn('[Push] Could not compare VAPID keys (non-fatal):', keyCheckErr);
        }
      }

      if (user?.id && !shouldSkipDbCalls()) {
        saveSubscriptionToDb(user.id, subscription).catch(() => {});
      }

      setIsSubscribed(true);
    } catch (error) {
      logger.error('[Push] Error in checkSubscription:', error);
    }
  }, [user?.id, VAPID_PUBLIC_KEY, urlBase64ToUint8Array, saveSubscriptionToDb]);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
      checkSubscription();
    }

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED' && user?.id) {
        logger.log('[Push] SW renewed subscription in background — refreshing DB');
        checkSubscription();
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready
        .then((registration) => {
          (registration as any).sync?.register('sync-notifications').catch(() => {});
        })
        .catch(() => {});
    }

    const handlePermissionChange = () => {
      setPermission(Notification.permission);
      checkSubscription();
    };

    let permissionStatus: PermissionStatus | null = null;
    let usingVisibilityFallback = false;

    const setupPermissions = async () => {
      try {
        if ('permissions' in navigator) {
          permissionStatus = await navigator.permissions.query({ name: 'notifications' });
          permissionStatus.addEventListener('change', handlePermissionChange);
        } else {
          usingVisibilityFallback = true;
          document.addEventListener('visibilitychange', handlePermissionChange);
        }
      } catch {
        usingVisibilityFallback = true;
        document.addEventListener('visibilitychange', handlePermissionChange);
      }
    };
    setupPermissions();

    // Cleanup that actually runs!
    return () => {
      if (permissionStatus) {
        permissionStatus.removeEventListener('change', handlePermissionChange);
        permissionStatus = null;
      }
      if (usingVisibilityFallback) {
        document.removeEventListener('visibilitychange', handlePermissionChange);
      }
    };
  }, [checkSubscription]);

  const subscribeToNotifications = async (): Promise<boolean> => {
    logger.log('--- Start Notification Subscription Process ---');

    const isIOS = /iP(hone|od|ad)/.test(navigator.userAgent);
    const isStandaloneIOS =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (isIOS && !isStandaloneIOS) {
      setShowIOSGuide(true);
      return false;
    }

    if (!user?.id) {
      logger.warn('User not logged in, cannot subscribe');
      return false;
    }

    const isLocalhost =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (window.location.protocol !== 'https:' && !isLocalhost) {
      logger.error('Insecure environment (not HTTPS/localhost)');
      toast({
        title: 'بيئة غير آمنة',
        description:
          'يجب استخدام HTTPS لتفعيل الإشعارات. أنت تتصفح عبر رابط غير آمن حالياً.',
        variant: 'destructive',
      });
      return false;
    }

    if (shouldSkipDbCalls()) {
      toast({
        title: 'الخدمة غير متاحة حالياً',
        description:
          'تعذر الاتصال بقاعدة البيانات مؤقتاً. يرجى التحقق من الاتصال والمحاولة مرة أخرى بعد دقيقة.',
        variant: 'destructive',
      });
      return false;
    }

    try {
      if (!('Notification' in window)) {
        logger.error('Notifications API not supported in this browser');
        throw new Error(
          'متصفحك لا يدعم نظام الإشعارات. جرب استخدام Chrome أو Safari (نسخة حديثة).'
        );
      }

      logger.log('Current permission status:', Notification.permission);

      if (Notification.permission === 'denied') {
        logger.warn('Permission previously denied');
        toast({
          title: 'الإشعارات محظورة',
          description:
            'لقد قمت بحظر الإشعارات مسبقاً. يرجى الضغط على أيقونة القفل بجانب شريط العنوان وتفعيل الإشعارات يدوياً.',
          variant: 'destructive',
        });
        return false;
      }

      logger.log('Requesting permission from browser...');

      let perm: NotificationPermission;
      try {
        perm = await Notification.requestPermission();
      } catch (e) {
        perm = await new Promise((resolve) => {
          (Notification.requestPermission as any)((p: NotificationPermission) => resolve(p));
        });
      }

      logger.log('Permission result:', perm);
      setPermission(perm);

      if (perm === 'granted') {
        logger.log('Permission granted! Initializing Service Worker check...');

        if (!('serviceWorker' in navigator)) {
          logger.error('ServiceWorker API not supported');
          throw new Error('متصفحك لا يدعم الـ Service Worker.');
        }

        logger.log('Waiting for Service Worker registration to be ready...');
        const registration = await navigator.serviceWorker.ready;
        logger.log('Service Worker registration found:', registration.scope);

        if (!registration.pushManager) {
          logger.error('PushManager API not supported');
          throw new Error(
            'متصفحك يدعم الإشعارات ولكن ليس عبر نظام Push. إذا كنت تستخدم iPhone، يرجى إضافة التطبيق للشاشة الرئيسية (Add to Home Screen) أولاً.'
          );
        }

        if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY === 'your_vapid_public_key_here') {
          logger.error('VAPID_PUBLIC_KEY missing or placeholder');
          throw new Error('مفتاح الإشعارات (VAPID) غير مضبوط في النظام.');
        }

        if (!registration.active) {
          logger.warn('Service worker not active, waiting for activation...');
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        logger.log('Preparing VAPID key and creating subscription...');
        const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });

        logger.log(
          'Subscription created successfully:',
          subscription.endpoint.substring(0, 30) + '...'
        );

        logger.log('Saving subscription to Supabase for user:', user.id);
        const saved = await saveSubscriptionToDb(user.id, subscription);
        if (!saved) throw new Error('فشل حفظ بيانات الاشتراك في قاعدة البيانات.');

        setIsSubscribed(true);
        logger.log('--- Subscription Process Completed Successfully ---');
        toast({ title: 'تم تفعيل الإشعارات بنجاح!' });
        onBatteryPermissionGranted();
        return true;
      } else {
        logger.warn('User dismissed the permission prompt');
        toast({
          title: 'لم يتم السماح',
          description:
            'يرجى السماح بالإشعارات من إعدادات المتصفح لتلقي التنبيهات.',
          variant: 'destructive',
        });
        return false;
      }
    } catch (error: any) {
      if (isNetworkLikeError(error)) recordDbFail();
      logger.error('CRITICAL: Push notification setup failed:', error);

      let errorMsg = `فشل الاشتراك: ${error.message}`;

      if (error.name === 'AbortError') {
        errorMsg =
          'فشل الاتصال بخدمة إشعارات المتصفح. قد يكون ذلك بسبب استخدام وضع التخفي (Incognito) أو وجود جدار حماية.';
      } else if (error.name === 'NotAllowedError') {
        errorMsg =
          'تم حظر الإشعارات من قبل المتصفح. يرجى تفعيلها يدوياً من إعدادات الموقع.';
      } else if (isNetworkLikeError(error)) {
        errorMsg =
          'تعذر الوصول إلى خدمة Supabase حالياً. تأكد من إضافة http://localhost:3000 إلى قائمة CORS في إعدادات Supabase، أو انتظر قليلاً في حالة وجود تعطيل مؤقت.';
      }

      toast({
        title: 'خطأ في الإشعارات',
        description: errorMsg,
        variant: 'destructive',
      });
      return false;
    }
  };

  const unsubscribeFromNotifications = async (): Promise<void> => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        if (!shouldSkipDbCalls()) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', subscription.endpoint)
            .catch(() => {});
        }
      }
      setIsSubscribed(false);
    } catch (err) {
      logger.warn('[Push] Unsubscribe failed:', err);
    }
  };

  return {
    permission,
    isSubscribed,
    subscribeToNotifications,
    unsubscribeFromNotifications,
    showIOSGuide,
    setShowIOSGuide,
    showBatteryGuide,
    dismissBatteryGuide,
  };
}
