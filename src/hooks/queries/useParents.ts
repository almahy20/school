import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
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

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // البدء بجلب الرتب (roles) أولاً لتحديد من هم أولياء الأمور
  let rolesQuery = supabase
    .from('user_roles')
    .select('user_id, id, approval_status, role, school_id', { count: 'estimated' }) // ⚡ estimated أسرع
    .eq('role', 'parent')
    .eq('school_id', schoolId);

  if (status !== 'الكل') {
    rolesQuery = rolesQuery.eq('approval_status', status === 'معتمد' ? 'approved' : 'pending');
  }

  const { data: userRoles, error: rolesError, count } = await rolesQuery;

  if (rolesError) throw rolesError;
  if (!userRoles || userRoles.length === 0) return { data: [], count: 0 };

  // جلب الملفات الشخصية (profiles) لهؤلاء المستخدمين - ⚡ تحديد الأعمدة فقط
  const userIds = userRoles.map(ur => ur.user_id);
  let profilesQuery = supabase
    .from('profiles')
    .select('id, full_name, phone, email, school_id, created_at') // ⚡ بدلاً من *
    .in('id', userIds);

  if (search) {
    profilesQuery = profilesQuery.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const { data: profiles, error: profileError } = await profilesQuery
    .order('full_name')
    .range(from, to);

  if (profileError) throw profileError;
  if (!profiles) return { data: [], count: 0 };


  // جلب روابط الأبناء والفصول في خطوة واحدة موازية لتقليل زمن الانتظار
  const parentIds = profiles.map(p => p.id);
  const [{ data: links }, { data: classes }] = await Promise.all([
    supabase.from('student_parents').select('parent_id, students(id, name, class_id)').in('parent_id', parentIds),
    supabase.from('classes').select('id, name').eq('school_id', schoolId)
  ]);

  const data = profiles.map((profile: any) => {
    const roleRecord = userRoles.find(ur => ur.user_id === profile.id);
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
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000, // 30 seconds - refresh more often to avoid "stale" feeling
    gcTime: 24 * 60 * 60 * 1000, // 24 hours - keep in IndexedDB for fast starts
    refetchOnMount: true, // Always check for fresh data when a component mounts
    retry: 1,
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
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 2,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
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
          .select('parent_id, students(id, name, class_id)')
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
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 2,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

// ✅ Hook جديد خفيف لصفحة التفاصيل - بيجيب البيانات الأساسية بس
export function useParentChildrenBasic(parentId: string | undefined | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['parent-children-basic', parentId, user?.schoolId],
    queryFn: async () => {
      if (!parentId || !user?.schoolId) return [];
      
      // نجيب الروابط + بيانات الطلاب الأساسية فقط
      const { data: links } = await supabase
        .from('student_parents')
        .select('students(id, name, class_id)')
        .eq('parent_id', parentId)
        .eq('school_id', user.schoolId);

      if (!links || links.length === 0) return [];

      // نجيب أسماء الفصول فقط
      const classIds = links
        .map((l: any) => l.students?.class_id)
        .filter(Boolean);

      let classes: any[] = [];
      if (classIds.length > 0) {
        const { data } = await supabase
          .from('classes')
          .select('id, name')
          .in('id', classIds);
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
    enabled: !!(parentId && user?.schoolId),
    staleTime: 1000 * 60 * 10, // 10 دقائق
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}


export function useParentAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userRoleId, status }: { userRoleId: string; status: 'approved' | 'rejected' }) => {
      const { error } = await (supabase.from('user_roles') as any)
        .update({ approval_status: status })
        .eq('id', userRoleId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(`تم ${variables.status === 'approved' ? 'قبول' : 'رفض'} ولي الأمر`);
      // Invalidate ALL parent-related queries with any parameters
      queryClient.invalidateQueries({ queryKey: ['parents'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'], exact: false });
    },
  });
}


export function useUpdateParent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Parent> & { id: string }) => {
      const { error } = await supabase.from('profiles').update({ ...data }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success('تم تحديث بيانات ولي الأمر');
      // Invalidate ALL parent-related queries with any parameters
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
      console.log('[Delete Parent] Using Edge Function for:', parentId);
      
      // Use the admin-users edge function for complete deletion
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'delete', userId: parentId },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      console.log('[Delete Parent] Response:', { data, error });

      if (error) {
        console.error('[Delete Parent] Function error:', error);
        throw new Error(error.message || 'فشل في حذف ولي الأمر');
      }
      
      if (!data?.success) {
        console.error('[Delete Parent] Unsuccessful:', data);
        throw new Error(data?.error || 'فشل في حذف ولي الأمر');
      }
      
      console.log('[Delete Parent] Success!');
      return parentId;
    },
    onSuccess: (parentId) => {
      // Remove from ALL caches immediately
      queryClient.removeQueries({ 
        predicate: (query) => 
          query.queryKey[0] === 'parents' || 
          query.queryKey[0] === 'parent-detail' ||
          query.queryKey[0] === 'admin-stats'
      });
      
      // Force refetch
      queryClient.invalidateQueries({ queryKey: ['parents'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

