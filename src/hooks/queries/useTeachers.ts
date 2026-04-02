import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Teacher {
  id: string;
  full_name: string;
  phone: string;
  school_id: string | null;
  approval_status: string;
  created_at: string;
}

async function fetchTeachers(schoolId: string | null, isSuperAdmin: boolean): Promise<Teacher[]> {
  const teacherRoles = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'teacher');

  if (!teacherRoles.data?.length) return [];

  const teacherIds = teacherRoles.data.map(r => r.user_id);
  const q = supabase.from('profiles').select('*').in('id', teacherIds).order('full_name');

  if (!isSuperAdmin && schoolId) {
    q.eq('school_id', schoolId);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export function useTeachers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['teachers', user?.schoolId, user?.isSuperAdmin],
    queryFn: () => fetchTeachers(user?.schoolId || null, !!user?.isSuperAdmin),
    enabled: !!(user?.schoolId || user?.isSuperAdmin),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
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
      queryClient.invalidateQueries({ queryKey: ['teachers', user?.schoolId] });
    },
  });
}
