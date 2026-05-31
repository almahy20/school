import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { queryClient } from '@/lib/queryClient';
import { logger } from '@/utils/logger';

function vibrate() {
  try {
    if ('vibrate' in navigator) navigator.vibrate([80, 40, 80]);
  } catch (_) {
    // Vibration not supported or failed
  }
}

async function showDesktopNotification(senderName: string, content: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    // ✅ Use Service Worker notification so it works even when app is in background
    // and supports click-to-open behavior via sw.js notificationclick handler
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(`رسالة من ${senderName}`, {
        body: content,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        dir: 'rtl',
        tag: 'new-message',
        renotify: true,
        data: { url: '/messages' },
        actions: [
          { action: 'open', title: 'فتح الرسائل' },
          { action: 'dismiss', title: 'تجاهل' },
        ],
      } as NotificationOptions);
    } else {
      // Fallback for browsers without SW support
      new Notification(`رسالة من ${senderName}`, {
        body: content,
        icon: '/icons/icon-192.png',
        dir: 'rtl',
      });
    }
  }
}

export function useMessageNotifications() {
  const { user } = useAuth();
  const location = useLocation();
  const locationRef = useRef(location.pathname);

  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  const handleNewMessage = useCallback(async (payload: any) => {
    const msg = payload.new as {
      id: string;
      sender_id: string;
      receiver_id: string;
      content: string;
    };

    // ✅ Security fix: filter is now on the server (receiver_id=eq.userId),
    // but we double-check client-side as a safety net
    if (msg.receiver_id !== user?.id) return;

    // Don't show notification if user is already on the messages page
    if (locationRef.current === '/messages') return;

    // Invalidate messages cache so the badge updates
    queryClient.invalidateQueries({ queryKey: ['messages', user?.id] });

    // Try to get sender name from cache first
    let senderName = 'مستخدم';
    const cachedProfile = queryClient.getQueryData(['profile-by-id', msg.sender_id]);
    if (cachedProfile) {
      senderName = (cachedProfile as any)?.full_name || 'مستخدم';
    } else {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('id', msg.sender_id)
          .maybeSingle();

        if (profile) {
          senderName = profile.full_name || 'مستخدم';
          queryClient.setQueryData(['profile-by-id', msg.sender_id], profile);
        }
      } catch (err) {
        logger.error('Failed to fetch sender profile:', err);
      }
    }

    vibrate();
    await showDesktopNotification(senderName, msg.content);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    // ✅ Security fix: filter by receiver_id so each user only receives their own messages
    // Previously this had NO filter — every user received ALL messages from the entire school
    const channel = supabase
      .channel(`messages-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        handleNewMessage
      )
      .subscribe((status) => {
        logger.log(`[MessageNotifications] Channel status: ${status}`);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, handleNewMessage]);
}
