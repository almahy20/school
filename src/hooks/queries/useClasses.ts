import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppUser } from '@/types/auth';
import { matchesArabic } from '@/utils/arabicSearch';

export interface Class {
  id: string;
  name: string;
  grade_level: string | null;
  school_id: string | null;
  teacher_id: string | null;
  curriculum_id?: string | null;
  created_at: string;
}

export function useAllClasses() {
  const { user, session } = useAuth();
  const queryKey = ['classes', 'all', user?.schoolId, user?.isSuperAdmin, user?.role, user?.id];
  
  return useQuery({
    queryKey,
    queryFn: async (): Promise<Class[]> => {
      if (!user?.isSuperAdmin && !user?.schoolId) return [];
      let q = supabase.from('classes').select('id, name, grade_level, school_id, teacher_id, curriculum_id, created_at');
      if (!user.isSuperAdmin && user.schoolId) q = q.eq('school_id', user.schoolId);
      const { data, error } = await q.order('name');
      if (error) throw error;
      return (data || []) as Class[];
    },
    enabled: !!(user?.schoolId || user?.isSuperAdmin),
    staleTime: 10 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

// ─── useClasses Hook (Instant 0ms in-memory search & filter) ────────────────
export function useClasses(page = 1, pageSize = 15, search = '', gradeLevel = 'الكل') {
  const allClassesQuery = useAllClasses();
  const allClasses = allClassesQuery.data || [];

  const filteredData = useMemo(() => {
    if (!allClasses.length) return { data: [], count: 0 };

    const cleanSearch = search.trim();

    const filtered = allClasses.filter((c) => {
      if (gradeLevel !== 'الكل') {
        if (c.grade_level !== gradeLevel) return false;
      }

      if (cleanSearch) {
        const match = matchesArabic(c.name, cleanSearch);
        if (!match) return false;
      }

      return true;
    });

    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    const paginated = filtered.slice(from, to);

    return {
      data: paginated,
      count: filtered.length,
    };
  }, [allClasses, page, pageSize, search, gradeLevel]);

  return {
    ...allClassesQuery,
    data: filteredData,
  };
}

export function useClass(id: string | undefined | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const queryKey = useMemo(() => ['class', id, user?.schoolId], [id, user?.schoolId]);
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!id) return null;
      
      let q = supabase
        .from('classes')
        .select('id, name, grade_level, school_id, teacher_id, curriculum_id, created_at')
        .eq('id', id);

      if (user?.schoolId) {
        q = q.eq('school_id', user.schoolId);
      }
      
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return data;
    },
    initialData: () => {
      if (!id) return undefined;
      const allQueries = queryClient.getQueriesData<Class[]>({ queryKey: ['classes', 'all'] });
      for (const [, list] of allQueries) {
        if (Array.isArray(list)) {
          const match = list.find((c) => c.id === id);
          if (match) return match;
        }
      }
      return undefined;
    },
    initialDataUpdatedAt: () => {
      const match = queryClient.getQueryState(['classes', 'all'])?.dataUpdatedAt;
      return match || 0;
    },
    enabled: !!id && !!(user?.schoolId || user?.isSuperAdmin),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

export function useTeacherClasses(teacherId: string | undefined) {
  const { user, session } = useAuth();
  const queryKey = useMemo(() => ['classes', 'teacher', teacherId, user?.schoolId], [teacherId, user?.schoolId]);
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!teacherId || !user?.schoolId) return [];
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, grade_level, school_id, teacher_id, curriculum_id, created_at')
        .eq('school_id', user.schoolId)
        .eq('teacher_id', teacherId)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!(session && teacherId && user?.schoolId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDeleteClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (classId: string) => {
      const { error } = await supabase.from('classes').delete().eq('id', classId);
      if (error) throw error;
      return classId;
    },
    onSuccess: () => {
      toast.success('تم حذف الفصل بنجاح');
      queryClient.invalidateQueries({ queryKey: ['classes'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['students'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['class-chat-rooms'], exact: false });
    },
  });
}

export function useAddClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (classData: Omit<Class, 'id' | 'created_at'>) => {
      const { data, error } = await supabase.from('classes').insert(classData).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('تم إضافة الفصل بنجاح');
      queryClient.invalidateQueries({ queryKey: ['classes'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['class-chat-rooms'], exact: false });
    },
  });
}

export function useUpdateClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Class> & { id: string }) => {
      const { error } = await supabase.from('classes').update({ ...data }).eq('id', id);
      if (error) throw error;
      return { id, ...data };
    },
    onMutate: async ({ id, ...data }) => {
      // Cancel in-flight queries
      await queryClient.cancelQueries({ queryKey: ['classes'] });

      // Snapshot previous state for rollback
      const previousClasses = queryClient.getQueriesData<Class[]>({ queryKey: ['classes'] });

      // Optimistically update cache
      queryClient.setQueriesData({ queryKey: ['classes'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map(c => c.id === id ? { ...c, ...data } : c);
      });

      return { previousClasses };
    },
    onError: (err: any, _variables, context) => {
      // Rollback to previous state on error
      if (context?.previousClasses) {
        context.previousClasses.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error('فشل تحديث الفصل', { description: err.message });
    },
    onSuccess: () => {
      toast.success('تم تحديث الفصل بنجاح');
      queryClient.invalidateQueries({ queryKey: ['classes'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['students'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['child-full-details'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['parent-children'], exact: false });
    },
  });
}
