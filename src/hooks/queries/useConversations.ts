import { useQuery, useMutation, useQueryClient, keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

const db = supabase as any;

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConversationStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type ConversationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type SenderRole = 'parent' | 'admin' | 'teacher';

export interface Conversation {
  id: string;
  school_id: string;
  parent_id: string;
  student_id: string | null;
  subject: string;
  status: ConversationStatus;
  priority: ConversationPriority;
  last_message_at: string;
  last_message_preview: string | null;
  unread_by_admin: number;
  unread_by_parent: number;
  messages_count: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  parent_name?: string;
  parent_phone?: string;
  student_name?: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: SenderRole;
  content: string;
  is_read: boolean;
  deleted_by_admin: boolean;
  deleted_at: string | null;
  created_at: string;
  // Joined
  sender_name?: string;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/** قائمة المحادثات للأدمن */
export function useAdminConversations(status: string = 'all', search: string = '') {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['conversations', 'admin', user?.schoolId, status, search];

  // Realtime subscription
  useEffect(() => {
    if (!user?.id || !user?.schoolId) return;

    const channel = db
      .channel(`admin-conversations-${user.schoolId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `school_id=eq.${user.schoolId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['conversations', 'admin', user.schoolId], exact: false });
      })
      .subscribe();

    return () => { db.removeChannel(channel); };
  }, [user?.id, user?.schoolId, queryClient]);

  return useQuery<Conversation[]>({
    queryKey,
    queryFn: async () => {
      if (!user?.schoolId) return [];

      let q = db
        .from('conversations')
        .select(`
          *,
          parent:profiles!conversations_parent_id_fkey(full_name, phone),
          student:students!conversations_student_id_fkey(name)
        `)
        .eq('school_id', user.schoolId);

      if (status !== 'all') q = q.eq('status', status);
      if (search.trim()) {
        q = q.ilike('subject', `%${search}%`);
      }

      const { data, error } = await q.order('last_message_at', { ascending: false });
      if (error) throw error;

      return (data || []).map((c: any) => ({
        ...c,
        parent_name:  c.parent?.full_name || 'ولي أمر',
        parent_phone: c.parent?.phone || '',
        student_name: c.student?.name || null,
      })) as Conversation[];
    },
    enabled: !!(session && user?.schoolId),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/** قائمة محادثات ولي الأمر */
export function useParentConversations() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['conversations', 'parent', user?.id];

  // Realtime
  useEffect(() => {
    if (!user?.id) return;

    const channel = db
      .channel(`parent-conversations-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `parent_id=eq.${user.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['conversations', 'parent', user.id], exact: false });
      })
      .subscribe();

    return () => { db.removeChannel(channel); };
  }, [user?.id, queryClient]);

  return useQuery<Conversation[]>({
    queryKey,
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await db
        .from('conversations')
        .select(`
          *,
          student:students!conversations_student_id_fkey(name)
        `)
        .eq('parent_id', user.id)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((c: any) => ({
        ...c,
        student_name: c.student?.name || null,
      })) as Conversation[];
    },
    enabled: !!(session && user?.id),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/** رسائل محادثة واحدة */
export function useConversationMessages(conversationId: string | null) {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['conversation-messages', conversationId];

  // Realtime للرسائل
  useEffect(() => {
    if (!conversationId || !user?.id) return;

    const channel = db
      .channel(`conv-messages-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'conversation_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload: any) => {
        // Optimistic append
        queryClient.setQueryData(queryKey, (old: ConversationMessage[] | undefined) => {
          const msgs = old || [];
          if (msgs.some(m => m.id === payload.new.id)) return msgs;
          return [...msgs, payload.new as ConversationMessage];
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversation_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();

    return () => { db.removeChannel(channel); };
  }, [conversationId, user?.id, queryClient]);

  return useQuery<ConversationMessage[]>({
    queryKey,
    queryFn: async () => {
      if (!conversationId) return [];

      const { data, error } = await db
        .from('conversation_messages')
        .select(`
          *,
          sender:profiles!conversation_messages_sender_id_fkey(full_name)
        `)
        .eq('conversation_id', conversationId)
        .eq('deleted_by_admin', false)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || []).map((m: any) => ({
        ...m,
        sender_name: m.sender?.full_name || 'مجهول',
      })) as ConversationMessage[];
    },
    enabled: !!(session && conversationId),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** إنشاء محادثة جديدة من ولي الأمر */
export function useCreateConversation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      subject,
      studentId,
      firstMessage,
    }: {
      subject: string;
      studentId?: string;
      firstMessage: string;
    }) => {
      if (!user?.id || !user?.schoolId) throw new Error('بيانات المستخدم غير مكتملة');

      // 1. إنشاء المحادثة
      const { data: conv, error: convErr } = await db
        .from('conversations')
        .insert({
          school_id:  user.schoolId,
          parent_id:  user.id,
          student_id: studentId || null,
          subject:    subject.trim(),
          status:     'open',
          priority:   'normal',
        })
        .select()
        .single();

      if (convErr) throw convErr;

      // 2. إضافة أول رسالة
      const { error: msgErr } = await db
        .from('conversation_messages')
        .insert({
          conversation_id: conv.id,
          sender_id:       user.id,
          sender_role:     'parent',
          content:         firstMessage.trim(),
        });

      if (msgErr) throw msgErr;

      return conv;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'], exact: false });
    },
    onError: (err: any) => {
      toast.error('حدث خطأ أثناء إنشاء المحادثة', { description: err.message });
    },
  });
}

/** إرسال رسالة في محادثة */
export function useSendConversationMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      content,
    }: {
      conversationId: string;
      content: string;
    }) => {
      if (!user?.id) throw new Error('المستخدم غير مسجّل الدخول');

      const senderRole: SenderRole =
        user.role === 'admin' || user.role === 'teacher' ? user.role : 'parent';

      const { data, error } = await db
        .from('conversation_messages')
        .insert({
          conversation_id: conversationId,
          sender_id:       user.id,
          sender_role:     senderRole,
          content:         content.trim(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      // Realtime handles the update, but invalidate as safety net
      queryClient.invalidateQueries({ queryKey: ['conversation-messages', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'], exact: false });
    },
    onError: (err: any) => {
      toast.error('فشل إرسال الرسالة', { description: err.message });
    },
  });
}

/** تغيير حالة المحادثة (أدمن فقط) */
export function useUpdateConversationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      priority,
    }: {
      id: string;
      status?: ConversationStatus;
      priority?: ConversationPriority;
    }) => {
      const updates: any = { updated_at: new Date().toISOString() };
      if (status)   updates.status   = status;
      if (priority) updates.priority = priority;

      const { data, error } = await db
        .from('conversations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'], exact: false });
      toast.success('تم تحديث الحالة');
    },
    onError: (err: any) => {
      toast.error('فشل تحديث الحالة', { description: err.message });
    },
  });
}

/** حذف رسالة (soft delete — أدمن فقط) */
export function useDeleteConversationMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await db
        .from('conversation_messages')
        .update({ deleted_by_admin: true, deleted_at: new Date().toISOString() })
        .eq('id', messageId);

      if (error) throw error;
    },
    onSuccess: (_, messageId) => {
      // Remove from cache optimistically
      queryClient.setQueriesData(
        { queryKey: ['conversation-messages'], exact: false },
        (old: ConversationMessage[] | undefined) =>
          old ? old.filter(m => m.id !== messageId) : old
      );
      toast.success('تم حذف الرسالة');
    },
    onError: (err: any) => {
      toast.error('فشل حذف الرسالة', { description: err.message });
    },
  });
}

/** تعليم رسائل المحادثة كمقروءة */
export function useMarkConversationRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      asRole,
    }: {
      conversationId: string;
      asRole: 'admin' | 'parent';
    }) => {
      // Reset unread counter
      const updates: any = {};
      if (asRole === 'admin')  updates.unread_by_admin  = 0;
      if (asRole === 'parent') updates.unread_by_parent = 0;

      const { error } = await db
        .from('conversations')
        .update(updates)
        .eq('id', conversationId);

      if (error) throw error;

      // Mark individual messages as read
      const senderRoleToMark = asRole === 'admin' ? 'parent' : 'admin';
      await db
        .from('conversation_messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .eq('sender_role', senderRoleToMark)
        .eq('is_read', false);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['conversation-messages', vars.conversationId] });
      // Update unread notification counts
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['notifications-unread-counts', user.id] });
      }
    },
  });
}

/** عدد المحادثات غير المقروءة للأدمن */
export function useUnreadConversationsCount() {
  const { user, session } = useAuth();

  return useQuery<number>({
    queryKey: ['conversations-unread-count', user?.schoolId],
    queryFn: async () => {
      if (!user?.schoolId) return 0;
      const { count, error } = await db
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', user.schoolId)
        .gt('unread_by_admin', 0);

      if (error) return 0;
      return count || 0;
    },
    enabled: !!(session && user?.schoolId && user?.role === 'admin'),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}

/** عدد المحادثات غير المقروءة لولي الأمر */
export function useUnreadConversationsParentCount() {
  const { user, session } = useAuth();

  return useQuery<number>({
    queryKey: ['conversations-parent-unread', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await db
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('parent_id', user.id)
        .gt('unread_by_parent', 0);

      if (error) return 0;
      return count || 0;
    },
    enabled: !!(session && user?.id && user?.role === 'parent'),
    staleTime: 60 * 1000,
  });
}
