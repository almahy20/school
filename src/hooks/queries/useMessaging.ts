import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useProfiles(search = '', page = 1, pageSize = 20) {
  const { user } = useAuth();
  const queryKey = ['profiles', user?.schoolId, search, page, pageSize];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.schoolId) return { data: [], count: 0 };
      
      let q = supabase
        .from('profiles')
        .select('id, full_name', { count: 'exact' })
        .eq('school_id', user.schoolId)
        .neq('id', user.id);

      if (search) {
        q = q.ilike('full_name', `%${search}%`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await q
        .order('full_name')
        .range(from, to);

      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
    enabled: !!user?.schoolId,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useSendMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    // التنفيذ المتفائل: إظهار الرسالة في القائمة فوراً
    onMutate: async ({ targets, content, senderName, studentId }: { targets: string[], content: string, senderName?: string, studentId?: string }) => {
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
        student_id: studentId || null,
        sender: { full_name: user?.fullName || 'أنا' },
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
    mutationFn: async ({ targets, content, senderName, studentId }: { targets: string[], content: string, senderName?: string, studentId?: string }) => {
      if (!user?.id || !user?.schoolId) {
        throw new Error('معلومات المستخدم غير مكتملة');
      }

      // 1. Send to messages table
      const messages = targets.map(targetId => ({
        sender_id: user.id,
        receiver_id: targetId,
        content: content.trim(),
        is_read: false,
        school_id: user.schoolId,
        student_id: studentId || null
      }));

      const { error: msgError } = await supabase.from('messages').insert(messages);
      if (msgError) {
        console.error('Message insert error:', msgError);
        throw msgError;
      }

      const notifications = targets.map(targetId => ({
        user_id: targetId,
        school_id: user.schoolId,
        type: senderName ? 'teacher_message' : 'broadcast_message',
        title: senderName ? `رسالة جديدة من ${senderName}` : 'رسالة جديدة من إدارة المدرسة',
        message: content.trim().substring(0, 100),
        is_read: false,
        metadata: { sender_id: user.id, full_content: content.trim(), student_id: studentId }
      }));

      const { error: ntError } = await (supabase as any).from('notifications').insert(notifications);
      if (ntError) {
        console.error('Notification insert error:', ntError);
        throw ntError;
      }

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
