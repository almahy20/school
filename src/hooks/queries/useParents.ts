import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeSync } from '../useRealtimeSync';

export interface Parent {
  id: string; // user_id
  full_name: string;
  phone: string;
  school_id: string | null;
  created_at: string;
  approval_status?: string;
  user_role_id?: string;
  children?: { id: string; name: string; class_name?: string }[];
}

async function fetchParents(schoolId: string | null): Promise<Parent[]> {
  if (!schoolId) return [];

  // Parallel fetch for better performance
  const [rolesRes, profilesRes, linksRes, classesRes] = await Promise.all([
    (supabase.from('user_roles') as any).select('id, user_id, approval_status').eq('role', 'parent').eq('school_id', schoolId),
    supabase.from('profiles').select('*').eq('school_id', schoolId).order('full_name'),
    supabase.from('student_parents').select('parent_id, students!student_parents_student_id_fkey(id, name, class_id)').eq('school_id', schoolId),
    supabase.from('classes').select('id, name').eq('school_id', schoolId)
  ]);

  const roles = rolesRes.data || [];
  const profiles = profilesRes.data || [];
  const links = linksRes.data || [];
  const classes = classesRes.data || [];

  if (!roles.length) return [];

  const parentUserIds = new Set(roles.map(r => r.user_id));

  return profiles
    .filter(p => parentUserIds.has(p.id))
    .map(profile => {
      const roleRecord = roles.find(r => r.user_id === profile.id);
      const parentLinks = (links as any[]).filter(l => l.parent_id === profile.id);
      
      return {
        ...profile,
        approval_status: roleRecord?.approval_status || 'approved',
        user_role_id: roleRecord?.id,
        children: parentLinks.map(l => ({
          id: l.students?.id,
          name: l.students?.name,
          class_name: classes.find(c => c.id === l.students?.class_id)?.name
        })).filter(c => c.id)
      };
    }) as Parent[];
}

export function useParents() {
  const { user } = useAuth();
  const queryKey = ['parents', user?.schoolId];
  
  useRealtimeSync('profiles', queryKey, user?.schoolId ? `school_id=eq.${user?.schoolId}` : undefined);
  useRealtimeSync('user_roles', queryKey);

  return useQuery({
    queryKey,
    queryFn: () => fetchParents(user?.schoolId || null),
    enabled: !!user?.schoolId,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchInterval: 15 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useParent(id: string | undefined | null) {
  const queryKey = ['parent', id];
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
      return data as Parent;
    },
    enabled: !!id,
    staleTime: 0,
    refetchInterval: 15 * 1000,
  });
}

export function useAdminParentChildren(parentId: string | undefined | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['parent-children', 'admin', parentId, user?.schoolId],
    queryFn: async () => {
      if (!parentId || !user?.schoolId) return [];
      
      const [linksRes, classesRes, curriculumsRes, subjectsRes] = await Promise.all([
        supabase.from('student_parents')
          .select('parent_id, students!student_parents_student_id_fkey(id, name, class_id)')
          .eq('parent_id', parentId)
          .eq('school_id', user.schoolId),
        supabase.from('classes').select('id, name, curriculum_id').eq('school_id', user.schoolId),
        supabase.from('curriculums').select('*').eq('school_id', user.schoolId),
        supabase.from('curriculum_subjects').select('*, curriculums!inner(school_id)').eq('curriculums.school_id', user.schoolId),
      ]);

      const links = linksRes.data || [];
      const classes = classesRes.data || [];
      const curriculums = curriculumsRes.data || [];
      const subjects = subjectsRes.data || [];

      return links
        .map((l: any) => l.students)
        .filter(Boolean)
        .map((s: any) => {
          const studentClass = classes.find(c => c.id === s.class_id);
          const studentCurriculum = curriculums.find(curr => curr.id === studentClass?.curriculum_id);
          const studentCurriculumSubjects = subjects.filter(sub => sub.curriculum_id === studentCurriculum?.id);

          return {
            id: s.id,
            name: s.name,
            class_name: studentClass?.name,
            curriculum: studentCurriculum ? {
              name: studentCurriculum.name,
              subjects: studentCurriculumSubjects.map(sub => ({
                subject_name: sub.subject_name,
                content: sub.content,
              })),
            } : null,
          };
        });
    },
    enabled: !!(parentId && user?.schoolId),
    staleTime: 5 * 60 * 1000,
  });
}


export function useParentAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userRoleId, status }: { userRoleId: string; status: 'approved' | 'rejected' }) => {
      const { error } = await (supabase.from('user_roles') as any).update({ approval_status: status }).eq('id', userRoleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parents'] });
      queryClient.invalidateQueries({ queryKey: ['parents-page'] });
    },
  });
}

export function useUpdateParent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Parent> & { id: string }) => {
      const { error } = await supabase.from('profiles').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parents'] });
    },
  });
}

export function useDeleteParent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (parentId: string) => {
      const { error } = await supabase.from('user_roles').delete().eq('user_id', parentId).eq('role', 'parent');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parents'] });
    },
  });
}
