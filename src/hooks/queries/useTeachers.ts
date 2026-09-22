import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { getAuthToken } from '@/utils/getAuthToken';
import { buildArabicSearchPatterns, matchesArabic } from '@/utils/arabicSearch';

export interface Teacher {
  id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  specialization?: string | null;
  school_id: string | null;
  approval_status: string;
  created_at: string;
  user_role_id?: string;
}

async function getFunctionErrorMessage(error: unknown, fallback: string) {
  const response = (error as { context?: Response })?.context;
  if (!response) return (error as Error)?.message || fallback;
  try {
    const payload = await response.clone().json();
    return payload?.error || payload?.message || (error as Error)?.message || fallback;
  } catch {
    try {
      const text = await response.clone().text();
      return text || (error as Error)?.message || fallback;
    } catch {
      return (error as Error)?.message || fallback;
    }
  }
}

/** Helper: invoke admin-users edge function with valid auth token */
async function invokeAdminUsers(body: object) {
  const token = await getAuthToken();
  return supabase.functions.invoke('admin-users', {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── useAllTeachers Hook (Single fetch cached in React Query) ────────────────
export function useAllTeachers(options?: { enabled?: boolean }) {
  const { user, session } = useAuth();
  const queryKey = ['teachers', 'all', user?.schoolId, user?.isSuperAdmin];

  return useQuery({
    queryKey,
    queryFn: async (): Promise<Teacher[]> => {
      let rolesQuery = (supabase.from('user_roles') as any)
        .select('user_id, id, approval_status, role, school_id')
        .eq('role', 'teacher');

      if (!user?.isSuperAdmin && user?.schoolId) {
        rolesQuery = rolesQuery.eq('school_id', user.schoolId);
      }

      const { data: userRoles, error: rolesError } = await rolesQuery;
      if (rolesError) throw rolesError;
      if (!userRoles || userRoles.length === 0) return [];

      const userIds = userRoles.map(ur => ur.user_id);
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, phone, email, school_id, created_at')
        .in('id', userIds)
        .order('full_name');

      if (profileError) throw profileError;

      return (profiles || []).map((profile: any) => {
        const roleRecord = userRoles.find(ur => ur.user_id === profile.id);
        return {
          ...profile,
          approval_status: roleRecord?.approval_status || 'approved',
          user_role_id: roleRecord?.id,
        };
      }) as Teacher[];
    },
    enabled: (options?.enabled ?? true) && !!session && !!(user?.schoolId || user?.isSuperAdmin),
    staleTime: 3 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 5000),
  });
}

// ─── useTeachers Hook (Instant in-memory 0ms search & filter) ────────────────
export function useTeachers(page = 1, pageSize = 15, search = '', status = 'الكل', options?: { enabled?: boolean }) {
  const allTeachersQuery = useAllTeachers(options);
  const allTeachers = allTeachersQuery.data || [];

  const filteredData = useMemo(() => {
    if (!allTeachers.length) return { data: [], count: 0 };

    const cleanSearch = search.trim();
    const cleanPhone = cleanSearch.replace(/\D/g, '');

    const filtered = allTeachers.filter((teacher) => {
      // 1. Filter by approval status
      if (status !== 'الكل') {
        const isApproved = teacher.approval_status === 'approved';
        if (status === 'معتمد' && !isApproved) return false;
        if (status === 'معلق' && isApproved) return false;
      }

      // 2. Filter by search (instant Arabic normalization & phone search)
      if (cleanSearch) {
        const nameMatch = matchesArabic(teacher.full_name, cleanSearch);
        const phoneMatch = cleanPhone.length >= 3 && Boolean(teacher.phone && teacher.phone.includes(cleanPhone));
        if (!nameMatch && !phoneMatch) return false;
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
  }, [allTeachers, page, pageSize, search, status]);

  return {
    ...allTeachersQuery,
    data: filteredData,
  };
}

export function useTeacher(id: string | undefined | null) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['teacher', id], [id]);

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone, email, school_id, created_at')
        .eq('id', id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return (data as unknown) as Teacher;
    },
    initialData: () => {
      if (!id) return undefined;
      const allQueries = queryClient.getQueriesData<Teacher[]>({ queryKey: ['teachers', 'all'] });
      for (const [, list] of allQueries) {
        if (Array.isArray(list)) {
          const match = list.find((t) => t.id === id);
          if (match) return match;
        }
      }
      return undefined;
    },
    initialDataUpdatedAt: () => {
      const match = queryClient.getQueryState(['teachers', 'all'])?.dataUpdatedAt;
      return match || 0;
    },
    enabled: !!id,
    placeholderData: keepPreviousData,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useTeacherDetailStats(id: string | undefined | null) {
  const { user, session } = useAuth();
  return useQuery({
    queryKey: ['teacher-stats', id, user?.schoolId],
    queryFn: async () => {
      if (!id || !user?.schoolId) return { studentCount: 0, curriculumProgress: 0 };

      const { data: classesData } = await supabase
        .from('classes')
        .select('id')
        .eq('school_id', user.schoolId)
        .eq('teacher_id', id);

      if (!classesData || classesData.length === 0) return { studentCount: 0, curriculumProgress: 0 };

      const classIds = classesData.map(c => c.id);

      const [{ count: studentCount }, { data: curriculumData }] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }).in('class_id', classIds),
        // @ts-expect-error - RPC function
        supabase.rpc('get_class_curriculum_status', { p_class_id: classIds[0] }),
      ]);

      const avgProgress = Array.isArray(curriculumData)
        ? Math.round(curriculumData.reduce((acc: number, s: any) => acc + (s.progress || 0), 0) / (curriculumData.length || 1))
        : 0;

      return { studentCount: studentCount || 0, curriculumProgress: avgProgress };
    },
    enabled: !!session && !!(id && user?.schoolId),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useDeleteTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (teacherId: string) => {
      logger.log('[Delete Teacher] Using Edge Function for:', teacherId);

      const { data, error } = await invokeAdminUsers({
        action: 'delete',
        userId: teacherId,
      });

      logger.log('[Delete Teacher] Response:', { data, error });

      if (error) {
        logger.error('[Delete Teacher] Function error:', error);
        throw new Error(error.message || 'فشل في حذف المعلم');
      }

      if (!data?.success) {
        logger.error('[Delete Teacher] Unsuccessful:', data);
        throw new Error(data?.error || 'فشل في حذف المعلم');
      }

      logger.log('[Delete Teacher] Success!');
      return teacherId;
    },
    onSuccess: () => {
      queryClient.removeQueries({
        predicate: (query) =>
          query.queryKey[0] === 'teachers' || query.queryKey[0] === 'teacher-detail',
      });
      queryClient.invalidateQueries({ queryKey: ['teachers'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['classes'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['students'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'], exact: false });
    },
  });
}

export function useTeacherAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, userRoleId, status }: { userId?: string; userRoleId?: string; status: 'approved' | 'rejected' }) => {
      if (!userId && !userRoleId) throw new Error('Missing teacher user id');

      const body = userId
        ? { action: 'update_status', userId, data: { status } }
        : { action: 'update_status_by_role_id', data: { userRoleId, status } };

      const { data, error } = await invokeAdminUsers(body);
      if (error) throw new Error(await getFunctionErrorMessage(error, 'Failed to update teacher status'));
      if (!data?.success) throw new Error(data?.error || 'Failed to update teacher status');
    },
    onSuccess: (_, variables) => {
      toast.success(`تم ${variables.status === 'approved' ? 'قبول' : 'رفض'} المعلم`);
      queryClient.invalidateQueries({ queryKey: ['teachers'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'], exact: false });
    },
  });
}

export function useUpdateTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, full_name, phone }: { id: string; full_name: string; phone: string }) => {
      const { data, error } = await invokeAdminUsers({
        action: 'update_profile',
        userId: id,
        data: { full_name, phone },
      });
      if (error) throw new Error(error.message || 'Failed to update teacher');
      if (!data?.success) throw new Error(data?.error || 'Failed to update teacher');
    },
    onSuccess: (_, variables) => {
      toast.success('تم تحديث بيانات المعلم');
      queryClient.invalidateQueries({ queryKey: ['teachers'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['teacher', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['teacher-stats'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['classes'], exact: false });
    },
  });
}
