import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { enqueueMutation } from '@/lib/offlineQueue';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Cast supabase to 'any' for the notifications table since it's not in the auto-generated types
// but exists in the actual database. This is safe because we control the schema.
const db = supabase as any;

export interface Notification {
  id: string;
  user_id: string;
  school_id?: string | null;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  metadata?: Record<string, any> | null;
  created_at: string;
}

export function useNotifications(page = 1, pageSize = 15) {
  const { user } = useAuth();
  const queryKey = ['notifications', user?.id, page, pageSize];
  
  return useQuery<{ data: Notification[]; count: number }>({
    queryKey,
    queryFn: async () => {
      if (!user?.id) return { data: [], count: 0 };
      
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await db
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to);
      
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
    enabled: !!user?.id,
    staleTime: 1 * 60 * 1000, // 1 minute - notifications should be fresh
    gcTime: 5 * 60 * 1000, // ⚡ 5 minutes
            refetchOnMount: true,
    placeholderData: keepPreviousData,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 5000),
  });
}

// Real-time subscription for notifications
export function useNotificationsRealtime() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return {
    subscribe: () => {
      if (!user?.id) return () => {};

      const channel = supabase
        .channel('notifications-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            // Invalidate queries to refetch
            queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
            queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', user.id] });
          }
        )
        .subscribe();

      // Return cleanup function
      return () => {
        supabase.removeChannel(channel);
      };
    }
  };
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      // Offline-first: queue if offline
      if (!window.navigator.onLine) {
        const mutationId = await enqueueMutation('update', 'notifications', { 
          markAllAsRead: true, 
          userId: user?.id 
        });
        toast.success('تم تحديد الكل كمقروء - سيتم التحديث عند الاتصال');
        return { id: mutationId, offline: true };
      }

      if (!user?.id) return { offline: false };
      const { error } = await db
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (error) throw error;
      return { offline: false };
    },
    onSuccess: (result) => {
      if (!result?.offline) {
        toast.success('تم تحديد الكل كمقروء');
      }
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', user?.id] });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      // Offline-first: queue if offline
      if (!window.navigator.onLine) {
        const mutationId = await enqueueMutation('delete', 'notifications', { id });
        toast.success('تم تحديد التنبيه للحذف - سيتم الحذف عند الاتصال');
        return { id: mutationId, offline: true };
      }

      const { error } = await db
        .from('notifications')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { offline: false };
    },
    onSuccess: (result) => {
      if (!result?.offline) {
        toast.success('تم حذف التنبيه');
      }
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', user?.id] });
    },
  });
}

export function useUnreadNotificationsCount() {
  const { user } = useAuth();
  const queryKey = useMemo(() => ['notifications-unread-count', user?.id], [user?.id]);
  // useRealtimeSync is disabled here because RealtimeNotificationsManager handles the logic globally
  // 
  return useQuery<number>({
    queryKey,
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await db
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchInterval: 15 * 1000,
  });
}
