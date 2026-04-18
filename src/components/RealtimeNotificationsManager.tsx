import { useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, MessageSquare, GraduationCap, AlertCircle, CreditCard } from 'lucide-react';
import { playNotificationSound, sendLocalNotification } from '@/utils/notifications';
import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';

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

  const handleNewNotification = useCallback((payload: any) => {
    const newNotification = payload.new;
    logger.log('🔔 Realtime Notifications: New event received', newNotification.type);

    // 1. Browser local notification
    sendLocalNotification(
      newNotification.title || 'تنبيه جديد',
      newNotification.message || 'لديك تحديث جديد في حسابك'
    );

    // 2. In-app Toast
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

    // 4. Cache Invalidation
    if (user?.id) {
      queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', user.id] });
    }
    queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
  }, [user?.id, queryClient]);

  useEffect(() => {
    if (!user?.id) return;

    // 1. Channel for personal notifications
    const notificationsChannel = supabase.channel('realtime-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, handleNewNotification)
      .subscribe();

    // 2. Channel for global school branding updates
    let brandingChannel: any = null;
    if (user.schoolId) {
      brandingChannel = supabase.channel('realtime-branding')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'schools',
          filter: `id=eq.${user.schoolId}`
        }, () => {
          logger.log('🔄 School Branding updated! Refreshing UI...');
          // Invalidate specific cache keys to trigger immediate re-fetch
          queryClient.invalidateQueries({ queryKey: ['school-branding', user.schoolId] });
        })
        .subscribe();
    }

    return () => {
      supabase.removeChannel(notificationsChannel);
      if (brandingChannel) supabase.removeChannel(brandingChannel);
    };
  }, [user?.id, user?.schoolId, handleNewNotification, queryClient]);

  return null;
}
// Force HMR reload
