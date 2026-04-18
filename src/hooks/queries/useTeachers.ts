import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';
import { toast } from 'sonner';

export interface Teacher {
  id: string; // This is the user_id (profiles.id)
  full_name: string;
  phone: string;
  email?: string | null;
  specialization?: string | null;
  school_id: string | null;
  approval_status: string;
  created_at: string;
  user_role_id?: string;
}


async function fetchTeachers(
  schoolId: string | null, 
  isSuperAdmin: boolean,
  page = 1,
  pageSize = 15,
  search = '',
  status = 'الكل'
): Promise<{ data: Teacher[]; count: number }> {
  // Step 1: Get user_roles for teachers first
  let rolesQuery = (supabase
    .from('user_roles') as any)
    .select('user_id, id, approval_status, role, school_id', { count: 'estimated' }) // ⚡ estimated أسرع من exact
    .eq('role', 'teacher');

  if (!isSuperAdmin && schoolId) {
    rolesQuery = rolesQuery.eq('school_id', schoolId);
  }

  if (status !== 'الكل') {
    rolesQuery = rolesQuery.eq('approval_status', status === 'معتمد' ? 'approved' : 'pending');
  }

  const { data: userRoles, error: rolesError, count } = await rolesQuery;

  if (rolesError) throw rolesError;
  if (!userRoles || userRoles.length === 0) return { data: [], count: 0 };

  // Step 2: Get profiles for these teachers - ⚡ تحديد الأعمدة المطلوبة فقط
  const userIds = userRoles.map(ur => ur.user_id);
  
  let profilesQuery = supabase
    .from('profiles')
    .select('id, full_name, phone, email, school_id, created_at') // ⚡ بدلاً من *
    .in('id', userIds);

  if (search) {
    profilesQuery = profilesQuery.ilike('full_name', `%${search}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: profiles, error: profileError } = await profilesQuery
    .order('full_name')
    .range(from, to);

  if (profileError) throw profileError;

  // Step 3: Merge profiles with user_roles
  const data = (profiles || []).map((profile: any) => {
    const roleRecord = userRoles.find(ur => ur.user_id === profile.id);
    return {
      ...profile,
      approval_status: roleRecord?.approval_status || 'approved',
      user_role_id: roleRecord?.id
    };
  }) as Teacher[];

  return { data, count: count || 0 };
}

export function useTeachers(page = 1, pageSize = 15, search = '', status = 'الكل') {
  const { user } = useAuth();
  const queryKey = ['teachers', user?.schoolId, user?.isSuperAdmin, page, pageSize, search, status];
        
  return useQuery({
    queryKey,
    queryFn: () => fetchTeachers(user?.schoolId || null, !!user?.isSuperAdmin, page, pageSize, search, status),
    enabled: !!(user?.schoolId || user?.isSuperAdmin),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000, // 5 دقائق - تقليل إعادة الجلب
    gcTime: 15 * 60 * 1000, // 15 دقيقة
    refetchOnMount: false, // معطل - نعتمد على staleTime و Realtime Sync
    retry: 2, // ⚡ Faster failure
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 5000),
  });
}

export function useTeacher(id: string | undefined | null) {
  const queryKey = useMemo(() => ['teacher', id], [id]);
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      // Handle missing profile gracefully
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      return (data as unknown) as Teacher;
    },
    enabled: !!id,
    placeholderData: keepPreviousData,
  });
}


export function useTeacherDetailStats(id: string | undefined | null) {
  const { user } = useAuth();
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
        supabase.rpc('get_class_curriculum_status', { p_class_id: classIds[0] })
      ]);

      const avgProgress = Array.isArray(curriculumData) 
        ? Math.round(curriculumData.reduce((acc: number, s: any) => acc + (s.progress || 0), 0) / (curriculumData.length || 1))
        : 0;

      return {
        studentCount: studentCount || 0,
        curriculumProgress: avgProgress
      };
    },
    enabled: !!(id && user?.schoolId),

  });
}



export function useDeleteTeacher() {

  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (teacherId: string) => {
      console.log('[Delete Teacher] Using Edge Function for:', teacherId);
      
      // Use the admin-users edge function for complete deletion
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'delete', userId: teacherId },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      console.log('[Delete Teacher] Response:', { data, error });

      if (error) {
        console.error('[Delete Teacher] Function error:', error);
        throw new Error(error.message || 'فشل في حذف المعلم');
      }
      
      if (!data?.success) {
        console.error('[Delete Teacher] Unsuccessful:', data);
        throw new Error(data?.error || 'فشل في حذف المعلم');
      }
      
      console.log('[Delete Teacher] Success!');
      return teacherId;
    },
    onSuccess: (teacherId) => {
      // Remove from ALL caches immediately
      queryClient.removeQueries({ 
        predicate: (query) => 
          query.queryKey[0] === 'teachers' || 
          query.queryKey[0] === 'teacher-detail'
      });
      
      // Force refetch
      queryClient.invalidateQueries({ queryKey: ['teachers'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });
}


export function useTeacherAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userRoleId, status }: { userRoleId: string; status: 'approved' | 'rejected' }) => {
      const { error } = await (supabase.from('user_roles') as any).update({ approval_status: status }).eq('id', userRoleId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(`تم ${variables.status === 'approved' ? 'قبول' : 'رفض'} المعلم`);
      // Invalidate ALL teacher queries with any parameters
      queryClient.invalidateQueries({ queryKey: ['teachers'], exact: false });
    },
  });
}


export function useUpdateTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, full_name, phone }: { id: string; full_name: string; phone: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name, phone })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success('تم تحديث بيانات المعلم');
      // Invalidate ALL teacher queries with any parameters
      queryClient.invalidateQueries({ queryKey: ['teachers'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['teacher', variables.id] });
    },
  });
}

