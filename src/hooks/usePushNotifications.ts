import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function usePushNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY; // We'll assume the user will set this

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    if ('serviceWorker' in navigator && 'PushManager' in window && user?.id) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(subscription !== null);
      } catch (error) {
        console.error('Error checking push subscription:', error);
      }
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    // ─── Ensure we have no spaces or quotes ───
    const cleaned = base64String.trim().replace(/^"|"$/g, '');
    
    const padding = '='.repeat((4 - cleaned.length % 4) % 4);
    const base64 = (cleaned + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    
    try {
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      
      console.log(`VAPID Key Decoded: ${outputArray.length} bytes (expected 65 for P-256)`);
      if (outputArray.length !== 65) {
        console.error('Invalid VAPID Public Key length! It must be 65 bytes uncompressed.');
      }
      return outputArray;
    } catch (e) {
      console.error('Failed to decode base64 VAPID key:', e);
      throw new Error('Invalid VAPID key format');
    }
  };

  const subscribeToNotifications = async (): Promise<boolean> => {
    if (!user?.id || !VAPID_PUBLIC_KEY) {
      if (!VAPID_PUBLIC_KEY) {
         console.error("❌ Push Service Error: VITE_VAPID_PUBLIC_KEY is not defined in environment variables.");
         toast({ 
           title: 'خطأ في إعدادات النظام', 
           description: 'مفتاح VAPID غير معرف. يرجى الاتصال بالدعم الفني.', 
           variant: 'destructive' 
         });
      }
      return false;
    }

    try {
      console.log('🔔 Requesting notification permission...');
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm === 'granted') {
        console.log('✅ Notification permission granted.');
        const registration = await navigator.serviceWorker.ready;
        console.log('👷 Service Worker ready:', registration.scope);
        
        // ─── Try to clear existing subscription first ───
        try {
          const existing = await registration.pushManager.getSubscription();
          if (existing) {
            await existing.unsubscribe();
            console.log('🔄 Unsubscribed from existing push service to ensure a clean state.');
          }
        } catch (e) {
          console.warn('⚠️ Failed to unsubscribe from existing push service (non-fatal):', e);
        }

        const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        
        console.log('📡 Subscribing to push service...');
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });
        console.log('✅ Push subscription successful:', subscription.endpoint);

        // ─── Register Periodic Sync (if supported) ───
        try {
          if ('periodicSync' in registration) {
            const status = await (navigator as any).permissions.query({
              name: 'periodic-background-sync',
            });
            if (status.state === 'granted') {
              await (registration as any).periodicSync.register('keep-alive', {
                minInterval: 12 * 60 * 60 * 1000, // 12 hours
              });
              console.log('✅ Periodic Background Sync Registered');
            }
          }
        } catch (e) {
          console.warn('⚠️ Periodic sync registration failed (non-fatal):', e);
        }

        // Save to Supabase (using upsert if subscription exists)
        const subJson = subscription.toJSON();
        console.log('💾 Saving subscription to database...');
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
          console.error('❌ Database error saving subscription:', error);
          throw error;
        }
        
        console.log('✨ Push notification setup complete!');
        setIsSubscribed(true);
        toast({ title: 'تم تفعيل الإشعارات بنجاح!', description: 'ستتلقى الإشعارات الفورية الخاصة بك من الآن فصاعداً.' });
        return true;
      } else {
        console.warn('🚫 Notification permission denied.');
        toast({ title: 'لم يتم السماح', description: 'يرجى السماح بالإشعارات من إعدادات المتصفح.', variant: 'destructive' });
        return false;
      }
    } catch (error: any) {
      console.error('❌ Critical error in push notification setup:', error);
      
      let errorMsg = `فشل الاشتراك: ${error.message}`;
      if (error.name === 'AbortError') {
        errorMsg = 'خدمة الإشعارات غير متاحة حالياً في متصفحك. يرجى التأكد من أنك لا تستخدم "وضع التصفح الخفي" (Incognito) وأن خدمات Google/Push غير محظورة في إعدادات المتصفح.';
      } else if (error.name === 'NotAllowedError') {
        errorMsg = 'يرجى السماح بالإشعارات من إعدادات المتصفح.';
      }

      toast({ 
        title: 'حدث خطأ في خدمة الإشعارات', 
        description: errorMsg, 
        variant: 'destructive' 
      });
      return false;
    }
  };

  return { permission, isSubscribed, subscribeToNotifications };
}
