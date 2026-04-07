import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, MessageSquare, GraduationCap, AlertCircle, CreditCard } from 'lucide-react';
import { playNotificationSound, sendLocalNotification } from '@/utils/notifications';
import React from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';

const getTypeConfig = (type: string) => {
  switch (type) {
    case 'new_fee':
    case 'fee_payment':
       return { icon: CreditCard, color: 'text-amber-500' };
    case 'new_grade':
       return { icon: GraduationCap, color: 'text-indigo-500' };
    case 'attendance_alert':
       return { icon: AlertCircle, color: 'text-rose-500' };
    case 'broadcast_message':
       return { icon: MessageSquare, color: 'text-emerald-500' };
    default:
       return { icon: Bell, color: 'text-slate-400' };
  }
};

export default function RealtimeNotificationsManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const handleNewNotification = useCallback((payload: any) => {
    const newNotification = payload.new;
    console.log('🔔 New Notification Received:', newNotification);

    // 1. Browser local notification (if permission granted)
    sendLocalNotification(
      newNotification.title || 'تنبيه جديد',
      newNotification.message || 'لديك تحديث جديد في حسابك'
    );

    // 2. In-app Toast (stacking - one per message)
    const config = getTypeConfig(newNotification.type);
    toast(newNotification.title, {
      description: newNotification.message,
      icon: React.createElement(config.icon, { className: `w-5 h-5 ${config.color}` }),
      duration: 10000,
      action: {
        label: 'عرض التنبيهات',
        onClick: () => { window.location.href = '/notifications'; }
      }
    });

    // 3. Play sound
    playNotificationSound();

    // 4. Invalidate React Query caches so all components reflect new data instantly
    if (user?.id) {
      queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', user.id] });
    }
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
  }, [user?.id, queryClient]);

  const setupChannel = useCallback(() => {
    if (!user?.id || !isMountedRef.current) return;

    // Clean up any existing channel first
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    console.log('📡 Subscribing to notifications channel for user:', user.id);

    const channel = supabase
      .channel(`global-notifications-${user.id}-${Date.now()}`) // Unique name prevents cache issues
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        handleNewNotification
      )
      .subscribe((status, err) => {
        if (!isMountedRef.current) return;
        console.log(`📡 Notifications channel status: ${status}`, err || '');

        if (status === 'SUBSCRIBED') {
          console.log('✅ Notifications channel connected successfully');
          // Clear any pending reconnect timers
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`⚠️ Notifications channel ${status}, will reconnect in 3s...`);
          // Schedule reconnect with exponential backoff
          reconnectTimerRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              console.log('🔄 Reconnecting notifications channel...');
              setupChannel();
            }
          }, 3000);
        }
      });

    channelRef.current = channel;
  }, [user?.id, handleNewNotification]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!user?.id) return;

    setupChannel();

    // Re-subscribe after network reconnection
    const handleOnline = () => {
      if (isMountedRef.current) {
        console.log('🌐 Network back online — re-subscribing notifications...');
        setupChannel();
      }
    };

    window.addEventListener('online', handleOnline);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('online', handleOnline);

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id, setupChannel, queryClient]);

  return null;
}
