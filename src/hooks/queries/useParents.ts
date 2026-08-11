import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';
import { logger } from '@/utils/logger';

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

async function fetchParents(
  schoolId: string | null,
  page = 1,
  pageSize = 15,
  search = '',
  status = 'الكل'
): Promise<{ data: Parent[]; count: number }> {
  if (!schoolId) return { data: [], count: 0 };

  // 🐛 BUGFIX (Regression من البند 5): سبب الـ 400 + 17s delay كان افتراض اسم FK غلط
  //     (`profiles!user_roles_user_id_fkey`) اللي ما كانش موجود فعلاً في الداتابيز.
  //     الحل: نعود للاستعلامات المنفصلة لكن نطبق الـ SERVER-SIDE pagination من أول خطوة
  //     على جدول user_roles نفسو باستخدام الـ .range، عشان ما نحفظش كل الرتب كلها.
  //     ده يحقق نفس هدف البند 5 (pagination على الاستعلام الأول بدلاً من جلب كل الصفوف)،
  //     بس بدون الـ FK name اللي ما كنا متأكدين منه.
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // الخطوة 1: جلب user_roles مع pagination + فلتر على الداتابيز (SERVER-SIDE)
  let rolesQuery = supabase
    .from('user_roles')
    .select('user_id, id, approval_status, role, school_id', { count: 'exact' })
    .eq('role', 'parent')
    .eq('school_id', schoolId);

  if (status !== 'الكل') {
    rolesQuery = rolesQuery.eq(
      'approval_status',
      status === 'معتمد' ? 'approved' : 'pending'
    );
  }

  const { data: userRoles, error: rolesError, count } = await rolesQuery
    .order('id')
    .range(from, to); // ✅ الـ pagination هنا على user_roles نفسها مباشرة من السيرفر

  if (rolesError) throw rolesError;
  if (!userRoles || userRoles.length === 0) return { data: [], count: 0 };

  // الخطوة 2: جلب الـ profiles لهذا الـ page فقط (pageSize=15 وليس كل أولياء الأمور)
  const userIds = userRoles.map(ur => ur.user_id);
  let profilesQuery = supabase
    .from('profiles')
    .select('id, full_name, phone, email, school_id, created_at')
    .in('id', userIds);

  if (search) {
    profilesQuery = profilesQuery.or(
      `full_name.ilike.%${search}%,phone.ilike.%${search}%`
    );
  }

  const { data: profilesRaw, error: profileError } = await profilesQuery
    .order('full_name');

  if (profileError) throw profileError;
  if (!profilesRaw) return { data: [], count: 0 };

  const profiles = (profilesRaw as any[]).map((profile) => {
    const roleRecord = userRoles.find(ur => ur.user_id === profile.id);
    return {
      ...profile,
      __approval_status: roleRecord?.approval_status || 'approved',
      __user_role_id: roleRecord?.id,
    };
  });

  const userRolesMap = new Map<string, any>();
  userRoles.forEach(ur => userRolesMap.set(ur.user_id, ur));

  // الخطوة 3: جلب روابط الأبناء والفصول في خطوة واحدة موازية لتقليل زمن الانتظار
  const parentIds = profiles.map(p => p.id);
  const [{ data: links }, { data: classes }] = await Promise.all([
    supabase.from('student_parents').select('parent_id, students(id, name, class_id)').in('parent_id', parentIds),
    supabase.from('classes').select('id, name').eq('school_id', schoolId)
  ]);

  const data = profiles.map((profile: any) => {
    const roleRecord = userRolesMap.get(profile.id);
    const parentLinks = (links || []).filter((l: any) => l.parent_id === profile.id);

    return {
      ...profile,
      approval_status: roleRecord?.approval_status || profile.__approval_status || 'approved',
      user_role_id: roleRecord?.id || profile.__user_role_id,

      children: parentLinks.map((l: any) => ({
        id: l.students?.id,
        name: l.students?.name,
        class_name: classes?.find((c: any) => c.id === l.students?.class_id)?.name
      })).filter((c: any) => c.id)
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
    enabled: session && !!user?.schoolId,
    placeholderData: keepPreviousData,
    staleTime: 3 * 60 * 1000, // 3 دقائق — Realtime يُحدّث الكاش عند أي تغيير
    gcTime: 24 * 60 * 60 * 1000, // 24 hours - keep in IndexedDB for fast starts
    refetchOnMount: false, // نعتمد على Realtime + staleTime
    retry: 1,
  });
}

// ─── usePendingParents Hook ─────────────────────────────────────────────────
// ⚡ LIGHTWEIGHT hook for the "waiting approval" queue on ParentsPage.
//    Returns only the essential fields (no children / no classes joins),
//    uses a single lean query instead of the 4 heavy requests triggered by
//    the regular useParents(1, 100, '', 'معلق') call.
export interface PendingParent {
  id: string;        // user_id
  full_name: string;
  phone: string;
  created_at: string;
  user_role_id?: string;
  approval_status?: string;
}

export function usePendingParents(limit = 100) {
  const { user, session } = useAuth();
  const queryKey = ['pending-parents', user?.schoolId, limit];

  return useQuery({
    queryKey,
    queryFn: async (): Promise<PendingParent[]> => {
      if (!user?.schoolId) return [];

      // 🐛 BUGFIX (Regression من البند 7): نفس سبب الـ 400 في useParents —
      //     كان في FK name مفترض `profiles!user_roles_user_id_fkey` غير صحيح.
      //     الحل: استعلامين خفيفين منفصلين (user_roles بعدين profiles للـ ids اللي جبتها)
      //     بدون أي joins ثقيلة — خفيف فعلاً زي ما كان المطلوب في البند 7.
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, id, approval_status')
        .eq('role', 'parent')
        .eq('school_id', user.schoolId)
        .eq('approval_status', 'pending')
        .limit(limit);

      if (rolesError) throw rolesError;
      if (!userRoles || userRoles.length === 0) return [];

      const userIds = userRoles.map(ur => ur.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, phone, created_at')
        .in('id', userIds)
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;
      if (!profiles) return [];

      const rolesMap = new Map<string, any>();
      userRoles.forEach(ur => rolesMap.set(ur.user_id, ur));

      return (profiles as any[]).map(profile => ({
        id: profile.id,
        full_name: profile.full_name,
        phone: profile.phone,
        created_at: profile.created_at,
        user_role_id: rolesMap.get(profile.id)?.id,
        approval_status: rolesMap.get(profile.id)?.approval_status,
      })) as PendingParent[];
    },
    enabled: session && !!user?.schoolId,
    staleTime: 60 * 1000, // 1 دقيقة — الشاشة بتفتح كثير، فمستنى أقل
    gcTime: 10 * 60 * 1000,
    refetchOnMount: true, // عند فتح صفحة أولياء الأمور نحدث قائمة الانتظار
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
  const { user, session } = useAuth();
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
    enabled: session && !!(parentId && user?.schoolId),
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 2,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

// ✅ Hook جديد خفيف لصفحة التفاصيل - بيجيب البيانات الأساسية بس
export function useParentChildrenBasic(parentId: string | undefined | null) {
  const { user, session } = useAuth();
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
    enabled: session && !!(parentId && user?.schoolId),
    staleTime: 1000 * 60 * 10, // 10 دقائق
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}


export function useParentAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, userRoleId, status }: { userId?: string; userRoleId?: string; status: 'approved' | 'rejected' }) => {
      if (!userId && !userRoleId) {
        throw new Error('Missing parent user id');
      }

      const body = userId
        ? { action: 'update_status', userId, data: { status } }
        : { action: 'update_status_by_role_id', data: { userRoleId, status } };

      const { data, error } = await supabase.functions.invoke('admin-users', {
        body,
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });
      if (error) throw new Error(await getFunctionErrorMessage(error, 'Failed to update parent status'));
      if (!data?.success) throw new Error(data?.error || 'Failed to update parent status');
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
      const { data: result, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'update_profile', userId: id, data },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });
      if (error) throw new Error(error.message || 'Failed to update parent');
      if (!result?.success) throw new Error(result?.error || 'Failed to update parent');
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
      logger.log('[Delete Parent] Using Edge Function for:', parentId);
      
      // Use the admin-users edge function for complete deletion
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'delete', userId: parentId },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
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
