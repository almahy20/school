import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
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
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
    retry: 1,
    retryDelay: 1000,
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
          () => {
            // Invalidate queries to refetch
            queryClient.invalidateQueries({ queryKey: ['notifications'], exact: false });
            queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'], exact: false });
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
      if (!user?.id) return;
      const { error } = await db
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (error) throw error;
    },
    // ✅ Optimization: Optimistic Update
    onMutate: async () => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ['notifications-unread-counts', user?.id] });

      // Snapshot the previous value
      const previousCounts = queryClient.getQueryData(['notifications-unread-counts', user?.id]);

      // Optimistically update to the new value
      queryClient.setQueryData(['notifications-unread-counts', user?.id], {
        unread: 0,
        complaints: 0
      });

      // Return a context object with the snapshotted value
      return { previousCounts };
    },
    onError: (err, newTodo, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousCounts) {
        queryClient.setQueryData(['notifications-unread-counts', user?.id], context.previousCounts);
      }
    },
    onSuccess: () => {
      toast.success('تم تحديد الكل كمقروء');
    },
    onSettled: () => {
      // Always refetch after error or success to ensure we are in sync with the server
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-counts', user?.id] });
    },
  });
}

export function useMarkComplaintsAsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await db
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('type', 'complaint')
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications-complaints-count', user?.id] });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from('notifications')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم حذف التنبيه');
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications-complaints-count', user?.id] });
    },
  });
}

export function useUnreadCounts() {
  const { user } = useAuth();
  const queryKey = useMemo(() => ['notifications-unread-counts', user?.id], [user?.id]);
  
  return useQuery<{ unread: number; complaints: number }>({
    queryKey,
    queryFn: async () => {
      if (!user?.id) return { unread: 0, complaints: 0 };
      
      // ✅ Optimization: One single query for both counts
      const { data, error } = await db
        .from('notifications')
        .select('type, is_read')
        .eq('user_id', user.id)
        .eq('is_read', false);
      
      if (error) throw error;
      
      const counts = {
        unread: (data || []).length,
        complaints: (data || []).filter((n: any) => n.type === 'complaint').length
      };
      
      return counts;
    },
    enabled: !!user?.id,
    staleTime: 0, // ✅ Always check for fresh counts on mount
    gcTime: 1000 * 60 * 60, // Keep in cache for an hour
    refetchOnWindowFocus: true, // Check when user comes back to tab
  });
}

// Keep the old ones for compatibility but mark them for deprecation or wrap the new one
export function useUnreadNotificationsCount() {
  const { data } = useUnreadCounts();
  return { data: data?.unread || 0, isLoading: false };
}

export function useUnreadComplaintsCount() {
  const { data } = useUnreadCounts();
  return { data: data?.complaints || 0, isLoading: false };
}
