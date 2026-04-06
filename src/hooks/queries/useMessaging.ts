import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useProfiles() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['profiles', user?.schoolId],
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
  });
}

export function useSendMessage() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ targets, content }: { targets: string[], content: string }) => {
      const messages = targets.map(targetId => ({
        sender_id: user?.id,
        receiver_id: targetId,
        content: content.trim(),
        is_read: false,
        school_id: user?.schoolId
      }));

      const { error } = await supabase.from('messages').insert(messages);
      if (error) throw error;
      return { targets, content };
    },
  });
}

export function useMessages() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['messages', user?.id],
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
  });
}
