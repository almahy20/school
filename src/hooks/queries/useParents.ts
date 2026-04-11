import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';

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

async function fetchParents(
  schoolId: string | null,
  page = 1,
  pageSize = 15,
  search = '',
  status = 'الكل'
): Promise<{ data: Parent[]; count: number }> {
  if (!schoolId) return { data: [], count: 0 };

  // Step 1: Get user_roles for parents first
  let rolesQuery = (supabase
    .from('user_roles') as any)
    .select('user_id, id, approval_status, role, school_id', { count: 'exact' })
    .eq('role', 'parent')
    .eq('school_id', schoolId);

  if (status !== 'الكل') {
    rolesQuery = rolesQuery.eq('approval_status', status === 'معتمد' ? 'approved' : 'pending');
  }

  const { data: userRoles, error: rolesError, count } = await rolesQuery;

  if (rolesError) throw rolesError;
  if (!userRoles || userRoles.length === 0) return { data: [], count: 0 };

  // Step 2: Get profiles for these parents
  const userIds = (userRoles as any[]).map(ur => ur.user_id);
  
  let profilesQuery = supabase
    .from('profiles')
    .select('*')
    .in('id', userIds);

  if (search) {
    profilesQuery = profilesQuery.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: profiles, error: profileError } = await profilesQuery
    .order('full_name')
    .range(from, to);

  if (profileError) throw profileError;

  // Step 3: Get children links for these parents
  const parentIds = (profiles || []).map(p => p.id);
  const { data: links } = await supabase
    .from('student_parents')
    .select('parent_id, students!student_parents_student_id_fkey(id, name, class_id)')
    .in('parent_id', parentIds);

  const { data: classes } = await supabase
    .from('classes')
    .select('id, name')
    .eq('school_id', schoolId);

  // Step 4: Merge profiles with user_roles and children
  const data = (profiles || []).map((profile: any) => {
    const roleRecord = (userRoles as any[]).find((ur: any) => ur.user_id === profile.id);
    const parentLinks = (links || []).filter(l => l.parent_id === profile.id);
    
    return {
      ...profile,
      approval_status: roleRecord?.approval_status || 'approved',
      user_role_id: roleRecord?.id,
      children: parentLinks.map((l: any) => ({
        id: l.students?.id,
        name: l.students?.name,
        class_name: classes?.find(c => c.id === l.students?.class_id)?.name
      })).filter(c => c.id)
    };
  }) as Parent[];

  return { data, count: count || 0 };
}

export function useParents(page = 1, pageSize = 15, search = '', status = 'الكل') {
  const { user } = useAuth();
  const queryKey = ['parents', user?.schoolId, page, pageSize, search, status];
    
  return useQuery({
    queryKey,
    queryFn: () => fetchParents(user?.schoolId || null, page, pageSize, search, status),
    enabled: !!user?.schoolId,
    staleTime: 5 * 1000, // ⚡ 5 seconds
    gcTime: 5 * 60 * 1000, // ⚡ 5 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    placeholderData: keepPreviousData,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 5000),
  });
}

export function useParent(id: string | undefined | null) {
  const queryKey = useMemo(() => ['parent', id], [id]);
  
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
      const { error } = await (supabase.from('user_roles') as any)
        .update({ approval_status: status, updated_at: new Date().toISOString() })
        .eq('id', userRoleId);
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
      // Optimistic update
      queryClient.setQueriesData({ queryKey: ['parents'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map(p => p.id === id ? { ...p, ...data, updated_at: new Date().toISOString() } : p);
      });

      const { error } = await supabase.from('profiles').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
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
