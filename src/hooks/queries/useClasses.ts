import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppUser } from '@/types/auth';
import { useMemo } from 'react';

export interface Class {
  id: string;
  name: string;
  grade_level: string | null;
  school_id: string | null;
  teacher_id: string | null;
  curriculum_id?: string | null;
  created_at: string;
}

async function fetchClasses(user: AppUser | null): Promise<Class[]> {
  if (!user?.isSuperAdmin && !user?.schoolId) return [];

  const q = supabase.from('classes').select('*');
  if (!user.isSuperAdmin && user.schoolId) {
    q.eq('school_id', user.schoolId);
  }
  if (user.role === 'teacher') {
    q.eq('teacher_id', user.id);
  }

  const { data, error } = await q.order('name');
  if (error) throw error;
  return data || [];
}

export function useClasses() {
  const { user } = useAuth();
  const queryKey = useMemo(() => ['classes', user?.schoolId, user?.isSuperAdmin, user?.role, user?.id], [user?.schoolId, user?.isSuperAdmin, user?.role, user?.id]);
  
  
  return useQuery({
    queryKey,
    queryFn: () => fetchClasses(user),
    enabled: !!(user?.schoolId || user?.isSuperAdmin),
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchInterval: 15 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useClass(id: string | undefined | null) {
  const queryKey = useMemo(() => ['class', id], [id]);
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Class;
    },
    enabled: !!id,
    staleTime: 0,
    refetchInterval: 15 * 1000,
  });
}

export function useTeacherClasses(teacherId: string | undefined) {
  const { user } = useAuth();
  const queryKey = useMemo(() => ['classes', 'teacher', teacherId, user?.schoolId], [teacherId, user?.schoolId]);
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!teacherId || !user?.schoolId) return [];
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', user.schoolId)
        .eq('teacher_id', teacherId)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!(teacherId && user?.schoolId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDeleteClass() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (classId: string) => {
      const { error } = await supabase.from('classes').delete().eq('id', classId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });
}

export function useAddClass() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (classData: Omit<Class, 'id' | 'created_at'>) => {
      const { data, error } = await supabase.from('classes').insert(classData).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });
}

export function useUpdateClass() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Class> & { id: string }) => {
      // Optimistic update
      queryClient.setQueriesData({ queryKey: ['classes'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map(c => c.id === id ? { ...c, ...data, updated_at: new Date().toISOString() } : c);
      });

      const { error } = await supabase.from('classes').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });
}
