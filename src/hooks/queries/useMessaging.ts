import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';

export function useProfiles() {
  const { user } = useAuth();
  const queryKey = useMemo(() => ['profiles', user?.schoolId], [user?.schoolId]);
  
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
  const queryClient = useQueryClient();
  
  return useMutation({
    // التنفيذ المتفائل: إظهار الرسالة في القائمة فوراً
    onMutate: async ({ targets, content }: { targets: string[], content: string }) => {
      await queryClient.cancelQueries({ queryKey: ['messages', user?.id] });
      const previousMessages = queryClient.getQueryData(['messages', user?.id]);
      
      const optimisticMessages = targets.map((targetId, index) => ({
        id: `temp-msg-${Date.now()}-${index}`,
        sender_id: user?.id,
        receiver_id: targetId,
        content: content.trim(),
        is_read: false,
        created_at: new Date().toISOString(),
        school_id: user?.schoolId,
        sender: { full_name: user?.full_name || 'أنا' },
        receiver: { full_name: 'جاري الإرسال...' } // Placeholder
      }));

      queryClient.setQueriesData({ queryKey: ['messages', user?.id] }, (old: any) => {
        if (!Array.isArray(old)) return [...optimisticMessages];
        return [...optimisticMessages, ...old]; // Prepend new messages
      });

      return { previousMessages };
    },
    onError: (err, newMsg, context) => {
      if (context?.previousMessages) {
        queryClient.setQueriesData({ queryKey: ['messages', user?.id] }, context.previousMessages);
      }
    },
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
    onSettled: () => {
      // إجبار التحديث بصمت للاستعاضة عن الرسائل المؤقتة بحقيقية
      queryClient.invalidateQueries({ queryKey: ['messages', user?.id] });
    }
  });
}

export function useMessages() {
  const { user } = useAuth();
  
  // نعيد بناء queryKey ليكون بسيطاً لكن مع ربطه بـ user?.id لتأمين البيانات
  const queryKey = ['messages', user?.id];
      
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
    gcTime: 10 * 60 * 1000,
    refetchInterval: 15 * 1000,
  });
}
