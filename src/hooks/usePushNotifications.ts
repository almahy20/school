import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { logger } from '@/utils/logger';

export function usePushNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showBatteryGuide, setShowBatteryGuide] = useState(false);

  const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY; // We'll assume the user will set this

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

  // ─── Helper: decode VAPID base64url → Uint8Array ───────────────────────────
  // Kept outside subscribeToNotifications so checkSubscription can reuse it.
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

  // ─── Helper: save/update subscription row in Supabase ───────────────────────
  const saveSubscriptionToDb = useCallback(async (
    userId: string,
    subscription: PushSubscription
  ): Promise<boolean> => {
    const subJson = subscription.toJSON();
    const { error } = await (supabase as any)
      .from('push_subscriptions')
      .upsert(
        { user_id: userId, subscription: subJson, endpoint: subscription.endpoint },
        { onConflict: 'endpoint' }
      );
    if (error) {
      logger.error('[Push] DB upsert error:', error);
      return false;
    }
    return true;
  }, []);

  const checkSubscription = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !user?.id) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      // ── Case 1: Permission revoked — clean up ────────────────────────────
      if (subscription && Notification.permission === 'denied') {
        await subscription.unsubscribe();
        setIsSubscribed(false);
        logger.warn('[Push] Subscription cleaned up — permission denied');
        return;
      }

      // ── Case 2: No subscription at all ──────────────────────────────────
      if (!subscription) {
        // Proactive re-registration: if permission is granted but subscription is null,
        // silently attempt to re-subscribe (handles 410 Gone + user cleared site data)
        if (Notification.permission === 'granted' && VAPID_PUBLIC_KEY && VAPID_PUBLIC_KEY !== 'your_vapid_public_key_here') {
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
          }
        } else {
          setIsSubscribed(false);
        }
        return;
      }

      // ── Case 3: Subscription exists — validate VAPID key match ──────────
      //
      // When VAPID keys are rotated, the browser's stored subscription was
      // signed with the OLD key. FCM will reject it with 410 (Gone) the first
      // time we try to send. We detect the mismatch HERE, at app load, and
      // silently resubscribe with the new key so the first real notification
      // is never lost.
      //
      // How we detect: PushSubscription.options.applicationServerKey is the
      // raw Uint8Array that was used when subscribe() was called. We compare
      // it byte-for-byte with the current VAPID_PUBLIC_KEY from env.
      if (VAPID_PUBLIC_KEY && VAPID_PUBLIC_KEY !== 'your_vapid_public_key_here') {
        try {
          const currentKeyBytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
          const storedKeyBytes  = subscription.options?.applicationServerKey
            ? new Uint8Array(subscription.options.applicationServerKey as ArrayBuffer)
            : null;

          const keysMatch =
            storedKeyBytes !== null &&
            storedKeyBytes.length === currentKeyBytes.length &&
            storedKeyBytes.every((byte, i) => byte === currentKeyBytes[i]);

          if (!keysMatch) {
            logger.warn('[Push] VAPID key mismatch — auto-resubscribing with new key...');

            // Unsubscribe old (dead) subscription
            await subscription.unsubscribe();

            // Only auto-resubscribe if we have permission — don't prompt user
            if (Notification.permission === 'granted') {
              const newSubscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: currentKeyBytes,
              });

              const saved = await saveSubscriptionToDb(user.id, newSubscription);
              if (saved) {
                setIsSubscribed(true);
                logger.log('[Push] Auto-resubscribe successful — new endpoint registered');
              } else {
                setIsSubscribed(false);
              }
            } else {
              setIsSubscribed(false);
              logger.warn('[Push] VAPID key mismatch found but permission not granted — skipping auto-resubscribe');
            }
            return;
          }
        } catch (keyCheckErr) {
          // Non-fatal: if key comparison fails for any reason, leave existing
          // subscription in place and let normal error handling deal with it.
          logger.warn('[Push] Could not compare VAPID keys (non-fatal):', keyCheckErr);
        }
      }

      // ── Case 4: Everything looks good ───────────────────────────────────
      setIsSubscribed(true);

    } catch (error) {
      logger.error('[Push] Error in checkSubscription:', error);
    }
  }, [user?.id, VAPID_PUBLIC_KEY, urlBase64ToUint8Array, saveSubscriptionToDb]);

  useEffect(() => {
    // ✅ نشيك مرة واحدة فقط - مش كل ما الـ component يتعمل rerender
    if ('Notification' in window) {
      setPermission(Notification.permission);
      checkSubscription();
    }
    
    // ✅ Listen for permission changes
    const handlePermissionChange = () => {
      setPermission(Notification.permission);
      checkSubscription();
    };
    
    // Some browsers support permission change events
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'notifications' }).then(permissionStatus => {
        permissionStatus.addEventListener('change', handlePermissionChange);
        return () => permissionStatus.removeEventListener('change', handlePermissionChange);
      }).catch(() => {
        // Fallback: check on visibility change
        document.addEventListener('visibilitychange', handlePermissionChange);
        return () => document.removeEventListener('visibilitychange', handlePermissionChange);
      });
    }
  }, [checkSubscription]); // ✅ أضفنا checkSubscription إلى الـ dependencies

  const subscribeToNotifications = async (): Promise<boolean> => {
    logger.log('--- Start Notification Subscription Process ---');

    // iOS non-standalone guard: Web Push لا يعمل على Safari بدون PWA mode
    const isIOS = /iP(hone|od|ad)/.test(navigator.userAgent);
    const isStandaloneIOS = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    if (isIOS && !isStandaloneIOS) {
      setShowIOSGuide(true);
      return false;
    }

    if (!user?.id) {
      logger.warn('User not logged in, cannot subscribe');
      return false;
    }

    // ✅ التحقق من البيئة الآمنة (HTTPS)
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (window.location.protocol !== 'https:' && !isLocalhost) {
      logger.error('Insecure environment (not HTTPS/localhost)');
      toast({ 
        title: 'بيئة غير آمنة', 
        description: 'يجب استخدام HTTPS لتفعيل الإشعارات. أنت تتصفح عبر رابط غير آمن حالياً.', 
        variant: 'destructive' 
      });
      return false;
    }

    try {
      // ✅ التحقق من دعم المتصفح للإشعارات قبل طلب الإذن
      if (!('Notification' in window)) {
        logger.error('Notifications API not supported in this browser');
        throw new Error('متصفحك لا يدعم نظام الإشعارات. جرب استخدام Chrome أو Safari (نسخة حديثة).');
      }

      logger.log('Current permission status:', Notification.permission);

      // ✅ إذا كان المستخدم قد رفض الطلب سابقاً، نوجهه للإعدادات
      if (Notification.permission === 'denied') {
        logger.warn('Permission previously denied');
        toast({ 
          title: 'الإشعارات محظورة', 
          description: 'لقد قمت بحظر الإشعارات مسبقاً. يرجى الضغط على أيقونة القفل بجانب شريط العنوان وتفعيل الإشعارات يدوياً.', 
          variant: 'destructive' 
        });
        return false;
      }

      logger.log('Requesting permission from browser...');
      
      // ✅ Some older browsers use a callback instead of a promise
      let perm: NotificationPermission;
      try {
        perm = await Notification.requestPermission();
      } catch (e) {
        // Fallback for older browsers
        perm = await new Promise((resolve) => {
          Notification.requestPermission((p) => resolve(p));
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
          throw new Error('متصفحك يدعم الإشعارات ولكن ليس عبر نظام Push. إذا كنت تستخدم iPhone، يرجى إضافة التطبيق للشاشة الرئيسية (Add to Home Screen) أولاً.');
        }

        // ✅ التحقق من وجود المفتاح قبل البدء
        if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY === 'your_vapid_public_key_here') {
          logger.error('VAPID_PUBLIC_KEY missing or placeholder');
          throw new Error('مفتاح الإشعارات (VAPID) غير مضبوط في النظام.');
        }

        // Ensure Service Worker is active
        if (!registration.active) {
          logger.warn('Service worker not active, waiting for activation...');
          await new Promise(resolve => setTimeout(resolve, 1500));
        }

        logger.log('Preparing VAPID key and creating subscription...');
        const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });

        logger.log('Subscription created successfully:', subscription.endpoint.substring(0, 30) + '...');

        logger.log('Saving subscription to Supabase for user:', user.id);
        const saved = await saveSubscriptionToDb(user.id, subscription);
        if (!saved) throw new Error('فشل حفظ بيانات الاشتراك في قاعدة البيانات.');
        
        setIsSubscribed(true);
        logger.log('--- Subscription Process Completed Successfully ---');
        toast({ title: 'تم تفعيل الإشعارات بنجاح!' });
        // Android battery optimization guidance
        onBatteryPermissionGranted();
        return true;
      } else {
        logger.warn('User dismissed the permission prompt');
        toast({ title: 'لم يتم السماح', description: 'يرجى السماح بالإشعارات من إعدادات المتصفح لتلقي التنبيهات.', variant: 'destructive' });
        return false;
      }
    } catch (error: any) {
      logger.error('CRITICAL: Push notification setup failed:', error);
      
      let errorMsg = `فشل الاشتراك: ${error.message}`;
      
      if (error.name === 'AbortError') {
        errorMsg = 'فشل الاتصال بخدمة إشعارات المتصفح. قد يكون ذلك بسبب استخدام وضع التخفي (Incognito) أو وجود جدار حماية.';
      } else if (error.name === 'NotAllowedError') {
        errorMsg = 'تم حظر الإشعارات من قبل المتصفح. يرجى تفعيلها يدوياً من إعدادات الموقع.';
      }

      toast({ 
        title: 'خطأ في الإشعارات', 
        description: errorMsg, 
        variant: 'destructive' 
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
        await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
      }
      setIsSubscribed(false);
    } catch (err) {
      logger.warn('[Push] Unsubscribe failed:', err);
    }
  };

  return { permission, isSubscribed, subscribeToNotifications, unsubscribeFromNotifications, showIOSGuide, setShowIOSGuide, showBatteryGuide, dismissBatteryGuide };
}

