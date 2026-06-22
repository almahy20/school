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

  const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY; // We'll assume the user will set this

  const checkSubscription = useCallback(async () => {
    if ('serviceWorker' in navigator && 'PushManager' in window && user?.id) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(subscription !== null);
        
        // ✅ If subscription exists but permission is denied, clean it up
        if (subscription && Notification.permission === 'denied') {
          await subscription.unsubscribe();
          setIsSubscribed(false);
          logger.warn('Push subscription cleaned up due to denied permission');
        }
      } catch (error) {
        logger.error('Error checking push subscription:', error);
      }
    }
  }, [user?.id]);

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

  const urlBase64ToUint8Array = (base64String: string) => {
    const cleaned = base64String.trim().replace(/^"|"$/g, '');
    const padding = '='.repeat((4 - cleaned.length % 4) % 4);
    const base64 = (cleaned + padding).replace(/-/g, '+').replace(/_/g, '/');
    
    try {
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    } catch (e) {
      logger.error('Failed to decode VAPID key:', e);
      throw new Error('Invalid VAPID key format');
    }
  };

  const subscribeToNotifications = async (): Promise<boolean> => {
    logger.log('--- Start Notification Subscription Process ---');
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
        const subJson = subscription.toJSON();

        logger.log('Saving subscription to Supabase for user:', user.id);
        const { error } = await (supabase as any)
          .from('push_subscriptions')
          .upsert({
            user_id: user.id,
            subscription: subJson,
            endpoint: subscription.endpoint
          }, { 
            onConflict: 'endpoint' 
          });

        if (error) {
          logger.error('Supabase save error:', error);
          throw error;
        }
        
        setIsSubscribed(true);
        logger.log('--- Subscription Process Completed Successfully ---');
        toast({ title: 'تم تفعيل الإشعارات بنجاح!' });
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


  return { permission, isSubscribed, subscribeToNotifications };
}

