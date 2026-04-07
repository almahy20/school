import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeSync } from '../useRealtimeSync';

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

export function useNotifications() {
  const { user } = useAuth();
  const queryKey = ['notifications', user?.id];
  // useRealtimeSync is disabled here because RealtimeNotificationsManager handles the logic globally
  // useRealtimeSync('notifications', queryKey, user?.id ? `user_id=eq.${user?.id}` : undefined);

  return useQuery<Notification[]>({
    queryKey,
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await db
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchInterval: 15 * 1000, // Polling fallback every 15s in case WS misses events
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    gcTime: 10 * 60 * 1000,
  });
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
    onSuccess: () => {
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
      const { error } = await db
        .from('notifications')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', user?.id] });
    },
  });
}

export function useUnreadNotificationsCount() {
  const { user } = useAuth();
  const queryKey = ['notifications-unread-count', user?.id];
  // useRealtimeSync is disabled here because RealtimeNotificationsManager handles the logic globally
  // useRealtimeSync('notifications', queryKey, user?.id ? `user_id=eq.${user?.id}` : undefined);

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
