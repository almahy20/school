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
       return { icon: MessageSquare, color: 'text-emerald-500' };
    default:
       return { icon: Bell, color: 'text-slate-400' };
  }
};

export default function RealtimeNotificationsManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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
        onClick: () => { navigate('/notifications'); }
      }
    });

    // 3. Play sound
    playNotificationSound();

    // 4. Cache Invalidation + Optimistic Update
    if (user?.id) {
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
      
      // ✅ Optimistic: Increment unread count immediately
      queryClient.setQueryData(['notifications-unread-counts', user.id], (old: any) => ({
        unread: (old?.unread || 0) + 1,
        complaints: old?.complaints || 0
      }));
    }
    
    // ✅ Optimization: Only invalidate admin stats if user is an admin
    if (user?.role === 'admin') {
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    }
  }, [user?.id, user?.role, queryClient, navigate]);

   useEffect(() => {
     if (!user?.id) return;

     // 1. Channel for personal notifications (Handle INSERT for toast, and all changes for sync)
     const notificationsChannel = supabase.channel(`notifications-${user.id}`)
       .on('postgres_changes', {
         event: 'INSERT',
         schema: 'public',
         table: 'notifications',
         filter: `user_id=eq.${user.id}`
       }, (payload) => {
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
             onClick: () => { navigate('/notifications'); }
           }
         });

         // 3. Play sound
         playNotificationSound();

         // 4. Optimistic increment for unread count
         queryClient.setQueryData(['notifications-unread-counts', user.id], (old: any) => ({
           unread: (old?.unread || 0) + 1,
           complaints: old?.complaints || 0
         }));

         // 5. Invalidate list to refetch
         queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });

         // 6. Admin stats
         if (user.role === 'admin') {
           queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
         }
       })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        }, () => {
          // ✅ Don't manipulate cache here — let markAllAsRead's optimistic update handle it.
          // Schedule a delayed direct DB fetch to get the final accurate count.
          if ((window as any).__notifUpdateTimer) clearTimeout((window as any).__notifUpdateTimer);
          (window as any).__notifUpdateTimer = setTimeout(async () => {
            try {
              const { data, error } = await (supabase as any)
                .from('notifications')
                .select('type, is_read')
                .eq('user_id', user.id)
                .eq('is_read', false);
              if (!error) {
                queryClient.setQueryData(['notifications-unread-counts', user.id], {
                  unread: (data || []).length,
                  complaints: (data || []).filter((n: any) => n.type === 'complaint').length
                });
              }
            } catch (e) {
              logger.warn('Failed to sync unread counts:', e);
            }
            queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
          }, 2000);
        })
       .subscribe();

     // ... rest unchanged ...

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
