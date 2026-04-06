import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppUser } from '@/types/auth';

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
  return useQuery({
    queryKey: ['classes', user?.schoolId, user?.isSuperAdmin, user?.role, user?.id],
    queryFn: () => fetchClasses(user),
    enabled: !!(user?.schoolId || user?.isSuperAdmin),
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useClass(id: string | undefined | null) {
  return useQuery({
    queryKey: ['class', id],
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
    staleTime: 60 * 1000,
  });
}

export function useTeacherClasses(teacherId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['classes', 'teacher', teacherId, user?.schoolId],
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
      const { error } = await supabase.from('classes').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });
}
