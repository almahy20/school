import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeSync } from '../useRealtimeSync';

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


async function fetchTeachers(schoolId: string | null, isSuperAdmin: boolean): Promise<Teacher[]> {
  // We use "as any" because approval_status might be missing from generated types
  const { data: teacherRoles, error: rolesError } = await (supabase.from('user_roles') as any)
    .select('id, user_id, approval_status')
    .eq('role', 'teacher');

  if (rolesError || !teacherRoles?.length) return [];

  const teacherIds = teacherRoles.map((r: any) => r.user_id);
  const q = supabase.from('profiles').select('*').in('id', teacherIds).order('full_name');

  if (!isSuperAdmin && schoolId) {
    q.eq('school_id', schoolId);
  }

  const { data: profiles, error: profileError } = await q;
  if (profileError) throw profileError;

  return (profiles || []).map(profile => {
    const roleRecord = teacherRoles.find((r: any) => r.user_id === profile.id);
    return {
      ...profile,
      approval_status: roleRecord?.approval_status || 'approved',
      user_role_id: roleRecord?.id
    };
  }) as Teacher[];
}

export function useTeachers() {
  const { user } = useAuth();
  const queryKey = ['teachers', user?.schoolId, user?.isSuperAdmin];

  // Subscribe to profile changes for real-time updates
  useRealtimeSync('profiles', queryKey, user?.isSuperAdmin ? undefined : `school_id=eq.${user?.schoolId}`);
  // Also subscribe to role changes (approvals)
  useRealtimeSync('user_roles', queryKey);

  return useQuery({
    queryKey,
    queryFn: () => fetchTeachers(user?.schoolId || null, !!user?.isSuperAdmin),
    enabled: !!(user?.schoolId || user?.isSuperAdmin),
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchInterval: 15 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useTeacher(id: string | undefined | null) {
  const queryKey = ['teacher', id];
  useRealtimeSync('profiles', queryKey, id ? `id=eq.${id}` : undefined);

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return (data as unknown) as Teacher;
    },
    enabled: !!id,
    staleTime: 0,
    refetchInterval: 15 * 1000,
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
    staleTime: 10 * 60 * 1000,
  });
}


export function useDeleteTeacher() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (teacherId: string) => {
      const { error } = await supabase.from('user_roles').delete().eq('user_id', teacherId).eq('role', 'teacher');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['teachers-page'] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['teachers-page'] });
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
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['teacher', variables.id] });
    },
  });
}
