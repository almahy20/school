import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/utils/logger';

export function usePushNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY; // We'll assume the user will set this

  const checkSubscription = useCallback(async () => {
    // ✅ Optimization: Skip in dev mode to prevent hanging on serviceWorker.ready
    if (import.meta.env.DEV) return;

    if ('serviceWorker' in navigator && 'PushManager' in window && user?.id) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(subscription !== null);
      } catch (error) {
        logger.error('Error checking push subscription:', error);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    // ✅ نشيك مرة واحدة فقط - مش كل ما الـ component يتعمل rerender
    if ('Notification' in window && !permission || permission === 'default') {
      setPermission(Notification.permission);
      checkSubscription();
    }
  }, []); // ❌ شلنا checkSubscription من الـ dependencies

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
    if (!user?.id) return false;

    // ✅ التحقق من وجود المفتاح قبل البدء
    if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY === 'your_vapid_public_key_here') {
      logger.error('Push notification failed: VAPID_PUBLIC_KEY is missing or invalid in .env');
      toast({ 
        title: 'خطأ في الإعدادات', 
        description: 'مفتاح الإشعارات (VAPID) غير مضبوط في ملف .env', 
        variant: 'destructive' 
      });
      return false;
    }

    try {
      // ✅ التحقق من دعم المتصفح للإشعارات قبل طلب الإذن
      if (!('Notification' in window)) {
        throw new Error('متصفحك لا يدعم نظام الإشعارات.');
      }

      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        
        // تنظيف أي اشتراك قديم
        try {
          const existing = await registration.pushManager.getSubscription();
          if (existing) await existing.unsubscribe();
        } catch (e) {
          logger.warn('Failed to unsubscribe existing push:', e);
        }

        const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });

        const subJson = subscription.toJSON();
        const { error } = await (supabase as any)
          .from('push_subscriptions')
          .upsert({
            user_id: user.id,
            subscription: subJson,
            endpoint: subscription.endpoint
          }, { 
            onConflict: 'endpoint'
          });

        if (error) throw error;
        
        setIsSubscribed(true);
        toast({ title: 'تم تفعيل الإشعارات بنجاح!' });
        return true;
      } else {
        toast({ title: 'لم يتم السماح', description: 'يرجى السماح بالإشعارات من إعدادات المتصفح لتلقي التنبيهات.', variant: 'destructive' });
        return false;
      }
    } catch (error: any) {
      logger.error('Push notification setup error:', error);
      
      let errorMsg = `فشل الاشتراك: ${error.message}`;
      
      // ✅ معالجة أخطاء محددة للمستخدم
      if (error.name === 'AbortError') {
        errorMsg = 'فشل الاتصال بخدمة إشعارات المتصفح. تأكد من عدم استخدام وضع "التصفح المتخفي" (Incognito) ومن جودة اتصالك بالإنترنت.';
      } else if (error.name === 'NotAllowedError') {
        errorMsg = 'تم حظر الإشعارات من قبل المتصفح. يرجى تفعيلها من إعدادات الموقع.';
      } else if (error.message?.includes('VAPID')) {
        errorMsg = 'مفتاح VAPID غير صالح. يرجى التأكد من المفاتيح في ملف .env';
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

