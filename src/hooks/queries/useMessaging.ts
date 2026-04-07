import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeSync } from '../useRealtimeSync';

export function useProfiles() {
  const { user } = useAuth();
  const queryKey = ['profiles', user?.schoolId];
  useRealtimeSync('profiles', queryKey, user?.schoolId ? `school_id=eq.${user?.schoolId}` : undefined);

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.schoolId) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('school_id', user.schoolId)
        .neq('id', user.id)
        .order('full_name');
      if (error) throw error;
      return data;
    },
    enabled: !!user?.schoolId,
    staleTime: 0,
    refetchInterval: 15 * 1000,
  });
}

export function useSendMessage() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ targets, content }: { targets: string[], content: string }) => {
      // 1. Send to messages table
      const messages = targets.map(targetId => ({
        sender_id: user?.id,
        receiver_id: targetId,
        content: content.trim(),
        is_read: false,
        school_id: user?.schoolId
      }));

      const { error: msgError } = await supabase.from('messages').insert(messages);
      if (msgError) throw msgError;

      // 2. Also send to notifications table for real-time alerts and PWA tracking
      const notifications = targets.map(targetId => ({
        user_id: targetId,
        school_id: user?.schoolId,
        type: 'broadcast_message',
        title: 'رسالة جديدة من إدارة المدرسة',
        message: content.trim().substring(0, 100),
        is_read: false,
        metadata: { sender_id: user?.id, full_content: content.trim() }
      }));

      const { error: ntError } = await (supabase as any).from('notifications').insert(notifications);
      if (ntError) throw ntError;

      return { targets, content };
    },
  });
}

export function useMessages() {
  const { user } = useAuth();
  const queryKey = ['messages', user?.id];
  useRealtimeSync('messages', queryKey); // Filter by sender/receiver handled by query but realtime will update

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(full_name),
          receiver:profiles!messages_receiver_id_fkey(full_name)
        `)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchInterval: 15 * 1000,
  });
}
