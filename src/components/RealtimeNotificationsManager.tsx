import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, MessageSquare, GraduationCap, AlertCircle, CreditCard } from 'lucide-react';
import { playNotificationSound, sendLocalNotification } from '@/utils/notifications';
import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';
import { useNavigate } from 'react-router-dom';
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
    case 'teacher_message':
      return { icon: MessageSquare, color: 'text-emerald-500' };
    case 'conversation_admin_reply':
    case 'conversation_new_message':
      return { icon: MessageSquare, color: 'text-indigo-500' };
    case 'class_chat_message':
      return { icon: MessageSquare, color: 'text-emerald-500' };
    default:
      return { icon: Bell, color: 'text-slate-400' };
  }
};

export default function RealtimeNotificationsManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // 🛡️ Refs لحفظ أخر قيمة للـ user بدون إعادة تشغيل الـ effect عند كل render
  const userIdRef = useRef<string | undefined>(user?.id);
  const userRoleRef = useRef<string | undefined>(user?.role);
  const schoolIdRef = useRef<string | undefined>(user?.schoolId ?? undefined);
  userIdRef.current = user?.id;
  userRoleRef.current = user?.role;
  schoolIdRef.current = user?.schoolId ?? undefined;

  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  // ✅ Local ref للـ debounce timer لمنع memory leaks عند الـ unmount
  const notifUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const userId = userIdRef.current;
    const schoolId = schoolIdRef.current;

    if (!userId) return;

    // ── Handler: إشعار جديد (INSERT) ──────────────────────────────────────────
    const handleNewNotification = (payload: any) => {
      const qc = queryClientRef.current;
      const nav = navigateRef.current;
      const role = userRoleRef.current;
      const newNotification = payload.new;

      logger.log('🔔 RealtimeNotifications: New notification', newNotification.type);

      sendLocalNotification(
        newNotification.title || 'تنبيه جديد',
        newNotification.message || 'لديك تحديث جديد في حسابك'
      );

      const config = getTypeConfig(newNotification.type);
      const isMessage =
        newNotification.type === 'broadcast_message' ||
        newNotification.type === 'teacher_message' ||
        newNotification.type === 'conversation_new_message' ||
        newNotification.type === 'conversation_admin_reply' ||
        newNotification.type === 'class_chat_message';

      toast(newNotification.title, {
        description: newNotification.message,
        icon: React.createElement(config.icon, { className: `w-5 h-5 ${config.color}` }),
        duration: 10000,
        action: {
          label: isMessage ? 'فتح الرسائل' : 'عرض التنبيهات',
          onClick: () => {
            const url = newNotification.metadata?.url;
            if (url) nav(url);
            else nav(isMessage ? '/conversations' : '/notifications');
          },
        },
      });

      playNotificationSound();

      if (userId) {
        qc.setQueryData(['notifications-unread-counts', userId], (old: any) => ({
          unread: (old?.unread || 0) + 1,
        }));
        qc.invalidateQueries({ queryKey: ['notifications', userId] });
      }

      if (role === 'admin') {
        qc.invalidateQueries({ queryKey: ['admin-stats'] });
        if (newNotification.type === 'conversation_new_message') {
          qc.invalidateQueries({ queryKey: ['conversations', 'admin'], exact: false });
          qc.invalidateQueries({ queryKey: ['conversations-unread-count'], exact: false });
        }
      }

      if (role === 'parent' && newNotification.type === 'conversation_admin_reply') {
        qc.invalidateQueries({ queryKey: ['conversations', 'parent'], exact: false });
        qc.invalidateQueries({ queryKey: ['conversations-parent-unread'], exact: false });
        const convId = newNotification.metadata?.conversation_id;
        if (convId) {
          qc.invalidateQueries({ queryKey: ['conversation-messages', convId] });
        }
      }

      if (role === 'parent' && newNotification.type === 'class_chat_message') {
        qc.invalidateQueries({ queryKey: ['conversations-parent-unread'], exact: false });
        const roomId = newNotification.metadata?.room_id;
        if (roomId) {
          qc.invalidateQueries({ queryKey: ['class-chat-messages', roomId] });
        }
      }
    };

    // ── Handler: تحديث إشعار (UPDATE — sync قراءة) ────────────────────────────
    const handleNotificationUpdate = (payload: any) => {
      const qc = queryClientRef.current;
      const { old: oldRow, new: newRow } = payload;

      if (oldRow.is_read === false && newRow.is_read === true) {
        qc.invalidateQueries({ queryKey: ['notifications', userId] });
        return;
      }

      if (notifUpdateTimerRef.current) clearTimeout(notifUpdateTimerRef.current);
      notifUpdateTimerRef.current = window.setTimeout(async () => {
        try {
          const unreadRes = await (supabase as any)
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_read', false);

          if (!unreadRes.error && userId) {
            qc.setQueryData(['notifications-unread-counts', userId], {
              unread: unreadRes.count || 0,
            });
          }
        } catch (e) {
          logger.warn('Failed to sync unread counts:', e);
        }
        qc.invalidateQueries({ queryKey: ['notifications', userId] });
      }, 4000);
    };

    // ──────────────────────────────────────────────────────────────────────────
    // ✅ التوحيد الكامل: الاشتراك عبر realtimeEngine الموحد (قناة واحدة فقط)
    //    بدلاً من فتح قنوات منفصلة مباشرة
    // ──────────────────────────────────────────────────────────────────────────

    // 1. أحداث INSERT للإشعارات — مفلترة بـ user_id
    const unsubInsert = realtimeEngine.subscribe(
      'notifications',
      handleNewNotification,
      { event: 'INSERT', filter: `user_id=eq.${userId}` }
    );

    // 2. أحداث UPDATE للإشعارات — مفلترة بـ user_id (sync قراءة)
    const unsubUpdate = realtimeEngine.subscribe(
      'notifications',
      handleNotificationUpdate,
      { event: 'UPDATE', filter: `user_id=eq.${userId}` }
    );

    // 3. تحديثات هوية المدرسة — مفلترة بـ school id
    let unsubBranding: (() => void) | null = null;
    if (schoolId) {
      unsubBranding = realtimeEngine.subscribe(
        'schools',
        () => {
          const qc = queryClientRef.current;
          logger.log('🔄 School branding updated, refreshing...');
          qc.invalidateQueries({ queryKey: ['school-branding', schoolId] });
        },
        { event: 'UPDATE', filter: `id=eq.${schoolId}` }
      );
    }

    // ── Cleanup: يُلغي الاشتراكات عند تغيير userId/schoolId أو unmount ────────
    return () => {
      unsubInsert();
      unsubUpdate();
      if (unsubBranding) unsubBranding();
      if (notifUpdateTimerRef.current) clearTimeout(notifUpdateTimerRef.current);
    };
    // 🛡️ dependency array: primitives فقط لمنع unsubscribe/resubscribe loop
  }, [user?.id, user?.schoolId]);

  return null;
}
