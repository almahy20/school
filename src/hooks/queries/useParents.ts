import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';
import { logger } from '@/utils/logger';
import { getAuthToken } from '@/utils/getAuthToken';

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

async function fetchParents(
  schoolId: string | null,
  page = 1,
  pageSize = 15,
  search = '',
  status = 'الكل'
): Promise<{ data: Parent[]; count: number }> {
  if (!schoolId) return { data: [], count: 0 };

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let userIds: string[] | null = null;

  if (search) {
    const { data: matchedProfiles, error: searchError } = await supabase
      .from('profiles')
      .select('id')
      .or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
    if (searchError) throw searchError;
    if (!matchedProfiles || matchedProfiles.length === 0) return { data: [], count: 0 };
    userIds = matchedProfiles.map(p => p.id);
  }

  let rolesQuery = supabase
    .from('user_roles')
    .select('user_id, id, approval_status, role, school_id', { count: 'exact' })
    .eq('role', 'parent')
    .eq('school_id', schoolId);

  if (status !== 'الكل') {
    rolesQuery = rolesQuery.eq('approval_status', status === 'معتمد' ? 'approved' : 'pending');
  }

  if (userIds !== null) {
    rolesQuery = rolesQuery.in('user_id', userIds);
  }

  const { data: userRoles, error: rolesError, count } = await rolesQuery
    .order('id')
    .range(from, to);

  if (rolesError) throw rolesError;
  if (!userRoles || userRoles.length === 0) return { data: [], count: 0 };

  const pageUserIds = userRoles.map(ur => ur.user_id);
  const { data: profilesRaw, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, phone, email, school_id, created_at')
    .in('id', pageUserIds)
    .order('full_name');

  if (profileError) throw profileError;
  if (!profilesRaw) return { data: [], count: 0 };

  const userRolesMap = new Map<string, any>();
  userRoles.forEach(ur => userRolesMap.set(ur.user_id, ur));

  const parentIds = profilesRaw.map((p: any) => p.id);
  const [{ data: links }, { data: classes }] = await Promise.all([
    supabase.from('student_parents').select('parent_id, students(id, name, class_id)').in('parent_id', parentIds),
    supabase.from('classes').select('id, name').eq('school_id', schoolId),
  ]);

  const data = (profilesRaw as any[]).map((profile) => {
    const roleRecord = userRolesMap.get(profile.id);
    const parentLinks = (links || []).filter((l: any) => l.parent_id === profile.id);
    return {
      ...profile,
      approval_status: roleRecord?.approval_status || 'approved',
      user_role_id: roleRecord?.id,
      children: parentLinks
        .map((l: any) => ({
          id: l.students?.id,
          name: l.students?.name,
          class_name: classes?.find((c: any) => c.id === l.students?.class_id)?.name,
        }))
        .filter((c: any) => c.id),
    };
  }) as Parent[];

  return { data, count: count || 0 };
}

export function useParents(page = 1, pageSize = 15, search = '', status = 'الكل') {
  const { user, session } = useAuth();
  const queryKey = ['parents', user?.schoolId, page, pageSize, search, status];

  return useQuery({
    queryKey,
    queryFn: () => fetchParents(user?.schoolId || null, page, pageSize, search, status),
    enabled: !!session && !!user?.schoolId,
    placeholderData: keepPreviousData,
    staleTime: 3 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export interface PendingParent {
  id: string;
  full_name: string;
  phone: string;
  created_at: string;
  user_role_id?: string;
  approval_status?: string;
  children_count?: number;
}

export function usePendingParents() {
  const { user, session } = useAuth();

  return useQuery({
    queryKey: ['pending-parents', user?.schoolId],
    queryFn: async () => {
      if (!user?.schoolId) return [];

      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('id, user_id, created_at, approval_status')
        .eq('school_id', user.schoolId)
        .eq('role', 'parent')
        .eq('approval_status', 'pending');

      if (rolesError) throw rolesError;
      if (!rolesData || rolesData.length === 0) return [];

      const userIds = rolesData.map((r: any) => r.user_id).filter(Boolean);
      let profilesMap = new Map<string, any>();

      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, phone')
          .in('id', userIds);

        if (!profilesError && profilesData) {
          profilesData.forEach((p: any) => profilesMap.set(p.id, p));
        }
      }

      return rolesData.map((roleRecord: any) => {
        const profile = profilesMap.get(roleRecord.user_id);
        return {
          id: profile?.id || roleRecord.user_id,
          full_name: profile?.full_name || 'بدون اسم',
          phone: profile?.phone || 'بدون هاتف',
          created_at: roleRecord.created_at,
          user_role_id: roleRecord.id,
          approval_status: roleRecord.approval_status,
        };
      }) as PendingParent[];
    },
    enabled: !!session && !!user?.schoolId,
    placeholderData: keepPreviousData,
    staleTime: 3 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useParent(id: string | undefined | null) {
  return useQuery({
    queryKey: ['parent', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data as Parent;
    },
    enabled: !!id,
    placeholderData: keepPreviousData,
    staleTime: 3 * 60 * 1000,
    gcTime: 1000 * 60 * 60 * 2,
    refetchOnWindowFocus: false,
  });
}

export const useParentDetails = useParent;

export function useAdminParentChildren(parentId: string | undefined | null) {
  const { user, session } = useAuth();
  return useQuery({
    queryKey: ['parent-children', 'admin', parentId, user?.schoolId],
    queryFn: async () => {
      if (!parentId || !user?.schoolId) return [];

      const [linksRes, classesRes, curriculumsRes, subjectsRes] = await Promise.all([
        supabase.from('student_parents').select('parent_id, students(id, name, class_id)').eq('parent_id', parentId).eq('school_id', user.schoolId),
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
            curriculum: studentCurriculum
              ? {
                  name: studentCurriculum.name,
                  subjects: studentCurriculumSubjects.map(sub => ({
                    subject_name: sub.subject_name,
                    content: sub.content,
                  })),
                }
              : null,
          };
        });
    },
    enabled: !!session && !!(parentId && user?.schoolId),
    staleTime: 15 * 1000,
    gcTime: 1000 * 60 * 60 * 2,
    refetchOnWindowFocus: true,
  });
}

export function useParentChildrenBasic(parentId: string | undefined | null) {
  const { user, session } = useAuth();
  return useQuery({
    queryKey: ['parent-children-basic', parentId, user?.schoolId],
    queryFn: async () => {
      if (!parentId || !user?.schoolId) return [];

      const { data: links } = await supabase
        .from('student_parents')
        .select('students(id, name, class_id)')
        .eq('parent_id', parentId)
        .eq('school_id', user.schoolId);

      if (!links || links.length === 0) return [];

      const classIds = links.map((l: any) => l.students?.class_id).filter(Boolean);
      let classes: any[] = [];
      if (classIds.length > 0) {
        const { data } = await supabase.from('classes').select('id, name').in('id', classIds);
        classes = data || [];
      }

      return links
        .map((l: any) => l.students)
        .filter(Boolean)
        .map((s: any) => ({
          id: s.id,
          name: s.name,
          class_name: classes.find((c: any) => c.id === s.class_id)?.name || 'بدون فصل',
        }));
    },
    enabled: !!session && !!(parentId && user?.schoolId),
    staleTime: 15 * 1000,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: true,
  });
}

export function useParentAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, userRoleId, status }: { userId?: string; userRoleId?: string; status: 'approved' | 'rejected' }) => {
      if (!userId && !userRoleId) throw new Error('Missing parent user id');

      const body = userId
        ? { action: 'update_status', userId, data: { status } }
        : { action: 'update_status_by_role_id', data: { userRoleId, status } };

      const { data, error } = await invokeAdminUsers(body);
      if (error) throw new Error(await getFunctionErrorMessage(error, 'Failed to update parent status'));
      if (!data?.success) throw new Error(data?.error || 'Failed to update parent status');
    },
    onSuccess: (_, variables) => {
      toast.success(`تم ${variables.status === 'approved' ? 'قبول' : 'رفض'} ولي الأمر`);
      queryClient.invalidateQueries({ queryKey: ['parents'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'], exact: false });
    },
  });
}

export function useUpdateParent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Parent> & { id: string }) => {
      const { data: result, error } = await invokeAdminUsers({
        action: 'update_profile',
        userId: id,
        data,
      });
      if (error) throw new Error(error.message || 'Failed to update parent');
      if (!result?.success) throw new Error(result?.error || 'Failed to update parent');
    },
    onSuccess: (_, variables) => {
      toast.success('تم تحديث بيانات ولي الأمر');
      queryClient.invalidateQueries({ queryKey: ['parents'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['parent-detail', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'], exact: false });
    },
  });
}

export function useDeleteParent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (parentId: string) => {
      logger.log('[Delete Parent] Using Edge Function for:', parentId);

      const { data, error } = await invokeAdminUsers({
        action: 'delete',
        userId: parentId,
      });

      logger.log('[Delete Parent] Response:', { data, error });

      if (error) {
        logger.error('[Delete Parent] Function error:', error);
        throw new Error(error.message || 'فشل في حذف ولي الأمر');
      }

      if (!data?.success) {
        logger.error('[Delete Parent] Unsuccessful:', data);
        throw new Error(data?.error || 'فشل في حذف ولي الأمر');
      }

      logger.log('[Delete Parent] Success!');
      return parentId;
    },
    onSuccess: () => {
      queryClient.removeQueries({
        predicate: (query) =>
          query.queryKey[0] === 'parents' ||
          query.queryKey[0] === 'parent-detail' ||
          query.queryKey[0] === 'admin-stats',
      });
      queryClient.invalidateQueries({ queryKey: ['parents'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}
