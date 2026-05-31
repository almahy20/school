import { useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, MessageSquare, GraduationCap, AlertCircle, CreditCard } from 'lucide-react';
import { playNotificationSound, sendLocalNotification } from '@/utils/notifications';
import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';
import { useNavigate } from 'react-router-dom';

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
    case 'teacher_message':
      return { icon: MessageSquare, color: 'text-emerald-500' };
    default:
      return { icon: Bell, color: 'text-slate-400' };
  }
};

export default function RealtimeNotificationsManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // ✅ Single handler — used for all INSERT events on notifications table
  const handleNewNotification = useCallback((payload: any) => {
    const newNotification = payload.new;
    logger.log('🔔 RealtimeNotifications: New notification', newNotification.type);

    // 1. Browser / SW local notification (works when app is in background)
    sendLocalNotification(
      newNotification.title || 'تنبيه جديد',
      newNotification.message || 'لديك تحديث جديد في حسابك'
    );

    // 2. In-app Toast with action button
    const config = getTypeConfig(newNotification.type);
    const isMessage =
      newNotification.type === 'broadcast_message' ||
      newNotification.type === 'teacher_message';

    toast(newNotification.title, {
      description: newNotification.message,
      icon: React.createElement(config.icon, { className: `w-5 h-5 ${config.color}` }),
      duration: 10000,
      action: {
        label: isMessage ? 'فتح الرسائل' : 'عرض التنبيهات',
        onClick: () => navigate(isMessage ? '/messages' : '/notifications'),
      },
    });

    // 3. Play sound
    playNotificationSound();

    // 4. Optimistic unread count increment
    if (user?.id) {
      queryClient.setQueryData(['notifications-unread-counts', user.id], (old: any) => ({
        unread: (old?.unread || 0) + 1,
        complaints:
          (old?.complaints || 0) +
          (newNotification.type?.startsWith('complaint') ? 1 : 0),
      }));

      // Invalidate list to refetch
      queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
    }

    // 5. Refresh admin stats if relevant
    if (user?.role === 'admin') {
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    }
  }, [user?.id, user?.role, queryClient, navigate]);

  // Handler for UPDATE events (mark-as-read sync)
  const handleNotificationUpdate = useCallback((payload: any) => {
    const { old: oldRow, new: newRow } = payload;

    // If this is a "mark as read" event triggered by our own UI,
    // trust the optimistic update — just silently refresh the list.
    if (oldRow.is_read === false && newRow.is_read === true) {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      return;
    }

    // For other content updates, do a debounced sync of unread counts
    if ((window as any).__notifUpdateTimer) clearTimeout((window as any).__notifUpdateTimer);
    (window as any).__notifUpdateTimer = setTimeout(async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('notifications')
          .select('type, is_read')
          .eq('user_id', user?.id)
          .eq('is_read', false);

        if (!error && user?.id) {
          queryClient.setQueryData(['notifications-unread-counts', user.id], {
            unread: (data || []).length,
            complaints: (data || []).filter((n: any) =>
              n.type?.startsWith('complaint')
            ).length,
          });
        }
      } catch (e) {
        logger.warn('Failed to sync unread counts:', e);
      }
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    }, 4000);
  }, [user?.id, queryClient]);

  useEffect(() => {
    if (!user?.id) return;

    // ✅ Single channel for all notification events (INSERT + UPDATE)
    // Filtered by user_id so each user only receives their own notifications
    const notificationsChannel = supabase
      .channel(`notifications-manager-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        handleNewNotification
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        handleNotificationUpdate
      )
      .subscribe((status) => {
        logger.log(`[NotificationsManager] Channel status: ${status}`);
      });

    // ✅ School branding updates channel (separate concern)
    let brandingChannel: ReturnType<typeof supabase.channel> | null = null;
    if (user.schoolId) {
      brandingChannel = supabase
        .channel(`branding-${user.schoolId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'schools',
            filter: `id=eq.${user.schoolId}`,
          },
          () => {
            logger.log('🔄 School branding updated, refreshing...');
            queryClient.invalidateQueries({
              queryKey: ['school-branding', user.schoolId],
            });
          }
        )
        .subscribe();
    }

    return () => {
      supabase.removeChannel(notificationsChannel);
      if (brandingChannel) supabase.removeChannel(brandingChannel);
    };
  }, [user?.id, user?.schoolId, handleNewNotification, handleNotificationUpdate, queryClient]);

  return null;
}
