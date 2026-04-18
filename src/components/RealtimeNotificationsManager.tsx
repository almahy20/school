import { useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, MessageSquare, GraduationCap, AlertCircle, CreditCard } from 'lucide-react';
import { playNotificationSound, sendLocalNotification } from '@/utils/notifications';
import React from 'react';
import { realtimeEngine } from '@/lib/RealtimeEngine';

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
    console.log('🔔 Realtime Notifications: New event received', newNotification.type);

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

    // Use robust engine for subscription
    const unsubscribe = realtimeEngine.subscribe(
      'notifications', 
      handleNewNotification, 
      { 
        event: 'INSERT', 
        filter: `user_id=eq.${user.id}` 
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user?.id, handleNewNotification]);

  return null;
}
