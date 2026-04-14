import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useMemo } from 'react';
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

async function fetchClasses(
  user: AppUser | null,
  page = 1,
  pageSize = 15,
  search = '',
  gradeLevel = 'الكل'
): Promise<{ data: Class[]; count: number }> {
  if (!user?.isSuperAdmin && !user?.schoolId) return { data: [], count: 0 };

  let q = supabase
    .from('classes')
    .select('*', { count: 'exact' });

  if (!user.isSuperAdmin && user.schoolId) {
    q = q.eq('school_id', user.schoolId);
  }
  // Teachers can now see all classes in their school (not just their own)
  // Removed: if (user.role === 'teacher') { q = q.eq('teacher_id', user.id); }

  if (search) {
    q = q.ilike('name', `%${search}%`);
  }

  if (gradeLevel !== 'الكل') {
    q = q.eq('grade_level', gradeLevel);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await q
    .order('name')
    .range(from, to);

  if (error) throw error;
  return { data: (data || []) as Class[], count: count || 0 };
}

export function useClasses(page = 1, pageSize = 15, search = '', gradeLevel = 'الكل') {
  const { user } = useAuth();
  const queryKey = ['classes', user?.schoolId, user?.isSuperAdmin, user?.role, user?.id, page, pageSize, search, gradeLevel];
  
  return useQuery({
    queryKey,
    queryFn: () => fetchClasses(user, page, pageSize, search, gradeLevel),
    enabled: !!(user?.schoolId || user?.isSuperAdmin),
    staleTime: 2 * 60 * 1000, // 2 minutes - professional app
    gcTime: 5 * 60 * 1000, // ⚡ 5 minutes
            refetchOnMount: true,
    placeholderData: keepPreviousData,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 5000),
  });
}

// دالة لجلب كافة الفصول (بدون تجزئة) لاستخدامها في القوائم المنسدلة
export function useAllClasses() {
  const { user } = useAuth();
  const queryKey = ['classes', 'all', user?.schoolId, user?.isSuperAdmin, user?.role, user?.id];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.isSuperAdmin && !user?.schoolId) return [];
      let q = supabase.from('classes').select('*');
      if (!user.isSuperAdmin && user.schoolId) q = q.eq('school_id', user.schoolId);
      // Teachers can now see all classes in their school (not just their own)
      // Removed: if (user.role === 'teacher') q = q.eq('teacher_id', user.id);
      const { data, error } = await q.order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!(user?.schoolId || user?.isSuperAdmin),
    staleTime: 5 * 60 * 1000,
  });
}

export function useClass(id: string | undefined | null) {
  const queryKey = useMemo(() => ['class', id], [id]);
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!id) return null;
      
      // Don't use .single() because it throws error if 0 rows (RLS block) or >1 rows
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('id', id);
      
      if (error) throw error;
      
      // Return first item or null
      return (data && data.length > 0) ? data[0] as Class : null;
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
        return old.map(c => c.id === id ? { ...c, ...data } : c);
      });

      const { error } = await supabase.from('classes').update({ ...data }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });
}
