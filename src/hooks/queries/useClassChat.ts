import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useMemo } from 'react';

const db = supabase as any;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClassChatRoom {
  id: string;
  school_id: string;
  class_id: string;
  name: string;
  created_at: string;
  // joined
  class_name?: string;
  grade_level?: string | null;
  room_id?: string | null;
  unread_count?: number;
  last_message?: string;
  last_message_at?: string;
}

export interface ClassChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string | null;
  content: string;
  created_at: string;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** كل فصول المدرسة مع غرف الدردشة الخاصة بها للأدمن/المدير والمعلمين */
export function useAdminClassChatRooms() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['class-chat-rooms', 'admin', user?.schoolId], [user?.schoolId]);

  useEffect(() => {
    if (!user?.schoolId) return;
    const channelName = `admin-rooms-${user.schoolId}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = db
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'class_chat_rooms',
        filter: `school_id=eq.${user.schoolId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();
    return () => {
      try { db.removeChannel(channel); } catch (_e) {}
    };
  }, [user?.schoolId, queryClient, queryKey]);

  return useQuery<ClassChatRoom[]>({
    queryKey,
    queryFn: async () => {
      if (!user?.schoolId) return [];

      // 1. جلب جميع فصول المدرسة
      const { data: classesData, error: classesErr } = await db
        .from('classes')
        .select('id, name, grade_level, school_id, created_at')
        .eq('school_id', user.schoolId)
        .order('name', { ascending: true })
        .limit(200); // مدرسة واحدة — 200 فصل أكثر من كافٍ

      if (classesErr) throw classesErr;

      // 2. جلب الغرف الموجودة حالياً
      const { data: existingRooms, error: roomsErr } = await db
        .from('class_chat_rooms')
        .select('id, school_id, class_id, name, created_at')
        .eq('school_id', user.schoolId)
        .limit(200);

      if (roomsErr) throw roomsErr;

      const roomsMap = new Map<string, any>();
      (existingRooms || []).forEach((r: any) => {
        roomsMap.set(r.class_id, r);
      });

      // 3. دمج الفصول مع الغرف — يضمن ظهور كل فصل في المدرسة للمدير
      return (classesData || []).map((cls: any) => {
        const room = roomsMap.get(cls.id);
        if (room) {
          return {
            ...room,
            class_name: cls.name || room.name,
            grade_level: cls.grade_level || null,
            room_id: room.id,
          };
        }
        return {
          id: cls.id,
          school_id: cls.school_id || user.schoolId,
          class_id: cls.id,
          name: `دردشة فصل ${cls.name}`,
          class_name: cls.name,
          grade_level: cls.grade_level || null,
          room_id: null,
          created_at: cls.created_at,
        };
      }) as ClassChatRoom[];
    },
    enabled: !!(session && user?.schoolId && (user?.role === 'admin' || user?.role === 'teacher')),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/** غرف الدردشة الخاصة بأبناء ولي الأمر */
export function useParentClassChatRooms() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['class-chat-rooms', 'parent', user?.id], [user?.id]);

  // Realtime: لما تُنشأ غرفة جديدة
  useEffect(() => {
    if (!user?.id || !user?.schoolId) return;
    const channel = db
      .channel(`parent-chat-rooms-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'class_chat_rooms',
        filter: `school_id=eq.${user.schoolId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, [user?.id, user?.schoolId, queryClient, queryKey]);

  return useQuery<ClassChatRoom[]>({
    queryKey,
    queryFn: async () => {
      if (!user?.id || !user?.schoolId) return [];

      // جلب class_ids الخاصة بأبناء ولي الأمر أولاً
      const { data: links, error: linksErr } = await db
        .from('student_parents')
        .select('students!student_parents_student_id_fkey(class_id)')
        .eq('parent_id', user.id)
        .eq('school_id', user.schoolId);

      if (linksErr) throw linksErr;

      const classIds = [...new Set(
        (links || [])
          .map((l: any) => l.students?.class_id)
          .filter(Boolean),
      )];

      if (!classIds.length) return [];

      // جلب غرف الفصول المرتبطة بأبناء ولي الأمر فقط
      const { data, error } = await db
        .from('class_chat_rooms')
        .select(`*, classes!class_chat_rooms_class_id_fkey(name)`)
        .eq('school_id', user.schoolId)
        .in('class_id', classIds)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || []).map((r: any) => ({
        ...r,
        class_name: r.classes?.name || r.name,
      })) as ClassChatRoom[];
    },
    enabled: !!(session && user?.id),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/** رسائل غرفة دردشة — آخر 100 رسالة */
export function useClassChatMessages(roomId: string | null) {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['class-chat-messages', roomId], [roomId]);

  // Realtime subscription
  useEffect(() => {
    if (!roomId || !user?.id) return;

    const channelName = `class-chat-${roomId}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = db
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'class_chat_messages',
        filter: `room_id=eq.${roomId}`,
      }, (payload: any) => {
        // Optimistic append
        queryClient.setQueryData(queryKey, (old: ClassChatMessage[] | undefined) => {
          const msgs = old || [];
          if (msgs.some(m => m.id === payload.new.id)) return msgs;
          return [...msgs, payload.new as ClassChatMessage];
        });
      })
      .subscribe();

    return () => {
      try { db.removeChannel(channel); } catch (_e) {}
    };
  }, [roomId, user?.id, queryClient, queryKey]);

  return useQuery<ClassChatMessage[]>({
    queryKey,
    queryFn: async () => {
      if (!roomId) return [];

      const { data, error } = await db
        .from('class_chat_messages')
        .select('id, room_id, sender_id, sender_name, content, created_at')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;
      return (data || []) as ClassChatMessage[];
    },
    enabled: !!(session && roomId),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });
}

/** إنشاء غرفة دردشة لفصل (idempotent) */
export function useEnsureClassChatRoom() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ classId, className }: { classId: string; className: string }) => {
      if (!user?.schoolId) throw new Error('school_id مفقود');

      // upsert idempotent — ينشئ الغرفة أو يتجاهل لو موجودة
      const { error: upsertErr } = await db
        .from('class_chat_rooms')
        .upsert(
          { school_id: user.schoolId, class_id: classId, name: `دردشة فصل ${className}` },
          { onConflict: 'school_id,class_id', ignoreDuplicates: true }
        );

      if (upsertErr) throw upsertErr;

      // اجلب الغرفة
      const { data, error } = await db
        .from('class_chat_rooms')
        .select('id, school_id, class_id, name, created_at')
        .eq('school_id', user.schoolId)
        .eq('class_id', classId)
        .single();

      if (error) throw error;
      return data as ClassChatRoom;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-chat-rooms'] });
    },
    onError: (err: any) => {
      toast.error('فشل فتح غرفة الدردشة', { description: err.message });
    },
  });
}

/** عدد الإشعارات غير المقروءة لكل غرفة — لعرض badge على الكارت */
export function useClassChatUnreadCounts() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['class-chat-unread', user?.id], [user?.id]);

  // Realtime: لما يجي إشعار جديد من نوع class_chat_message
  useEffect(() => {
    if (!user?.id) return;
    const channelName = `class-unread-${user.id}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = db
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload: any) => {
        if (payload.new?.type === 'class_chat_message') {
          queryClient.invalidateQueries({ queryKey });
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload: any) => {
        if (payload.new?.type === 'class_chat_message') {
          queryClient.invalidateQueries({ queryKey });
        }
      })
      .subscribe();
    return () => {
      try { db.removeChannel(channel); } catch (_e) {}
    };
  }, [user?.id, queryClient, queryKey]);

  return useQuery<Record<string, number>>({
    queryKey,
    queryFn: async () => {
      if (!user?.id) return {};

      // جلب إشعارات دردشة الفصل غير المقروءة
      const { data } = await db
        .from('notifications')
        .select('metadata')
        .eq('user_id', user.id)
        .eq('type', 'class_chat_message')
        .eq('is_read', false);

      // تجميع بـ room_id
      const counts: Record<string, number> = {};
      (data || []).forEach((n: any) => {
        const roomId = n.metadata?.room_id;
        if (roomId) counts[roomId] = (counts[roomId] || 0) + 1;
      });
      return counts;
    },
    enabled: !!(session && user?.id && user?.role === 'parent'),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/** تعليم إشعارات غرفة معينة كمقروءة لما يفتح المستخدم الدردشة */
export function useMarkClassChatRoomRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roomId: string) => {
      if (!user?.id) return;
      const { error } = await db
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('type', 'class_chat_message')
        .eq('is_read', false)
        .contains('metadata', { room_id: roomId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-chat-unread'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-parent-unread'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-counts'] });
    },
  });
}

/** إرسال رسالة في غرفة */
export function useSendClassChatMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ roomId, content }: { roomId: string; content: string }) => {
      if (!user?.id) throw new Error('المستخدم غير مسجّل الدخول');
      if (content.trim().length > 500) throw new Error('الرسالة تتجاوز 500 حرف');

      const { data, error } = await db
        .from('class_chat_messages')
        .insert({
          room_id:     roomId,
          sender_id:   user.id,
          sender_name: user.fullName || 'ولي أمر',
          content:     content.trim(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['class-chat-messages', vars.roomId] });
      queryClient.invalidateQueries({ queryKey: ['class-chat-rooms'] });
    },
    onError: (err: any) => {
      toast.error('فشل إرسال الرسالة', { description: err.message });
    },
  });
}
