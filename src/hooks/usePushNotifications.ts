import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

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
      } catch (error) {
        console.error('Error checking push subscription:', error);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
      checkSubscription();
    }
  }, [checkSubscription]);

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
      console.error('Failed to decode VAPID key:', e);
      throw new Error('Invalid VAPID key format');
    }
  };

  const subscribeToNotifications = async (): Promise<boolean> => {
    if (!user?.id || !VAPID_PUBLIC_KEY) return false;

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        
        try {
          const existing = await registration.pushManager.getSubscription();
          if (existing) await existing.unsubscribe();
        } catch (e) {
          // ignore cleanup errors
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
        toast({ title: 'لم يتم السماح', description: 'يرجى السماح بالإشعارات من إعدادات المتصفح.', variant: 'destructive' });
        return false;
      }
    } catch (error: any) {
      console.error('Push notification setup error:', error);
      
      let errorMsg = `فشل الاشتراك: ${error.message}`;
      if (error.name === 'AbortError') {
        errorMsg = 'خدمة الإشعارات غير متاحة حالياً في متصفحك.';
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

