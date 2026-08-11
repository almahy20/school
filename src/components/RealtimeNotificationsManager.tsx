import { useEffect, useCallback, useRef } from 'react';
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

  // 🐛 BUGFIX (Regression من البند 1): السبب الحقيقي للـ Subscribed/Closed LOOP كان
  //     في الـ useEffect dependencies اللي كانت بتشتمل على الـ handleNewNotification
  //     و handleNotificationUpdate (useCallback ب dependencies فيها user object و
  //     queryClient بيعملوا reference جديد كل render) + StrictMode.
  //     الحل: نستخدم useRef عشان نحفظ أخر قيمة لـ user.id / user.schoolId / user.role
  //     ونحط الـ handlers جوه الـ useEffect نفسها عشان ما يبقاش في dependency array،
  //     ودependency array يكون فقط user.id و user.schoolId كـ primitives (مش بيتغيروا
  //     كل render لو نفس القيمة).
  const userIdRef = useRef<string | undefined>(user?.id);
  const userRoleRef = useRef<string | undefined>(user?.role);
  const schoolIdRef = useRef<string | undefined>(user?.schoolId);
  userIdRef.current = user?.id;
  userRoleRef.current = user?.role;
  schoolIdRef.current = user?.schoolId;

  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  // ✅ FIX: Local ref for the debounce timer — replaces window.__notifUpdateTimer global
  const notifUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const userId = userIdRef.current;
    const schoolId = schoolIdRef.current;
    const role = userRoleRef.current;

    if (!userId) return;

    // ✅ Single handler — used for all INSERT events on notifications table
    const handleNewNotification = (payload: any) => {
      const qc = queryClientRef.current;
      const nav = navigateRef.current;
      const newNotification = payload.new;
      logger.log('🔔 RealtimeNotifications: New notification', newNotification.type);

      sendLocalNotification(
        newNotification.title || 'تنبيه جديد',
        newNotification.message || 'لديك تحديث جديد في حسابك'
      );

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
          onClick: () => nav(isMessage ? '/messages' : '/notifications'),
        },
      });

      playNotificationSound();

      if (userId) {
        qc.setQueryData(['notifications-unread-counts', userId], (old: any) => ({
          unread: (old?.unread || 0) + 1,
          complaints:
            (old?.complaints || 0) +
            (newNotification.type?.startsWith('complaint') ? 1 : 0),
        }));

        qc.invalidateQueries({ queryKey: ['notifications', userId] });
      }

      if (role === 'admin') {
        qc.invalidateQueries({ queryKey: ['admin-stats'] });
        // ✅ FIX: When a new complaint arrives, refresh the complaints list and
        //    dashboard activities so they update without a manual page reload.
        if (newNotification.type === 'complaint_new') {
          qc.invalidateQueries({ queryKey: ['complaints'], exact: false });
          qc.invalidateQueries({ queryKey: ['admin-activities'] });
        }
      }
    };

    // Handler for UPDATE events (mark-as-read sync)
    const handleNotificationUpdate = (payload: any) => {
      const qc = queryClientRef.current;
      const { old: oldRow, new: newRow } = payload;

      if (oldRow.is_read === false && newRow.is_read === true) {
        qc.invalidateQueries({ queryKey: ['notifications', userId] });
        return;
      }

      // ✅ FIX: Use a component-local ref for the timer instead of window global
      //    to avoid memory leaks on unmount / StrictMode double-invoke
      if (notifUpdateTimerRef.current) clearTimeout(notifUpdateTimerRef.current);
      notifUpdateTimerRef.current = window.setTimeout(async () => {
        try {
          const { data, error } = await (supabase as any)
            .from('notifications')
            .select('type, is_read')
            .eq('user_id', userId)
            .eq('is_read', false);

          if (!error && userId) {
            qc.setQueryData(['notifications-unread-counts', userId], {
              unread: (data || []).length,
              complaints: (data || []).filter((n: any) =>
                n.type?.startsWith('complaint')
              ).length,
            });
          }
        } catch (e) {
          logger.warn('Failed to sync unread counts:', e);
        }
        qc.invalidateQueries({ queryKey: ['notifications', userId] });
      }, 4000);
    };

    // ✅ Single channel for all notification events (INSERT + UPDATE)
    // Filtered by user_id so each user only receives their own notifications
    const notificationsChannel = supabase
      .channel(`notifications-manager-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        handleNewNotification
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        handleNotificationUpdate
      )
      .subscribe((status) => {
        logger.log(`[NotificationsManager] Channel status: ${status}`);
      });

    // ✅ School branding updates channel (separate concern)
    let brandingChannel: ReturnType<typeof supabase.channel> | null = null;
    if (schoolId) {
      brandingChannel = supabase
        .channel(`branding-${schoolId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'schools',
            filter: `id=eq.${schoolId}`,
          },
          () => {
            const qc = queryClientRef.current;
            logger.log('🔄 School branding updated, refreshing...');
            qc.invalidateQueries({
              queryKey: ['school-branding', schoolId],
            });
          }
        )
        .subscribe();
    }

    return () => {
      supabase.removeChannel(notificationsChannel);
      if (brandingChannel) supabase.removeChannel(brandingChannel);
      // ✅ FIX: Clear the debounce timer on cleanup to prevent memory leaks
      if (notifUpdateTimerRef.current) clearTimeout(notifUpdateTimerRef.current);
    };
    // 🛡️ مهم جداً: الـ dependency array ده فقط user?.id و user?.schoolId (PRIMITIVES)،
    //    مش الـ handlers ولا الـ objects، عشان ما يتغيروش كل render ويسببوا unsubscribe/resubscribe LOOP.
  }, [user?.id, user?.schoolId]);

  return null;
}
