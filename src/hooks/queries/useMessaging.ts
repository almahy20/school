import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/utils/logger';
import { useEffect, useMemo } from 'react';

export function useProfiles(search = '', page = 1, pageSize = 20) {
  const { user, session } = useAuth();
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
    enabled: !!(session && user?.schoolId),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
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
        logger.error('Message insert error:', msgError);
        throw msgError;
      }

      const notificationTitle = senderName
        ? `رسالة جديدة من ${senderName}`
        : 'رسالة جديدة من إدارة المدرسة';
      const notificationBody = content.trim().substring(0, 100);

      // ✅ Note: Database trigger `tr_notify_new_message` on `messages` table 
      // automatically creates notifications in DB. Direct client inserts violate RLS.

      // ✅ Note: Database triggers (tr_notify_new_message -> tr_auto_push_on_notification)
      // automatically generate DB notifications and fire push requests via pg_net reliably,
      // even if the user closes the app immediately after sending.
      return { targets, content };
    },
    onSettled: () => {
      // إجبار التحديث بصمت للاستعاضة عن الرسائل المؤقتة بحقيقية
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-counts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-activities'] });
    }
  });
}

export function useMessages() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  
  const queryKey = useMemo(() => ['messages', user?.id], [user?.id]);

  useEffect(() => {
    if (!user?.id || !session) return;

    const channel = supabase
      .channel(`user-messages-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `sender_id=eq.${user.id}`
      }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${user.id}`
      }, () => {
        logger.log('📩 New message detected, refreshing...');
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, session, queryClient, queryKey]);
      
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id, sender_id, receiver_id, content, is_read, created_at, school_id, student_id,
          sender:profiles!messages_sender_id_fkey(full_name),
          receiver:profiles!messages_receiver_id_fkey(full_name)
        `)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(200); // آخر 200 رسالة كافية للعرض
      if (error) throw error;
      return data;
    },
    enabled: !!(session && user?.id),
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchInterval: false,
  });
}
