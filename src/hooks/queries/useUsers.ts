import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/utils/logger';
import { getAuthToken } from '@/utils/getAuthToken';
import { buildArabicSearchPatterns, matchesArabic } from '@/utils/arabicSearch';

export interface UserProfile {
  id: string;
  user_id: string;
  school_id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  status: 'active' | 'inactive' | 'pending';
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

/** Helper: invoke admin-users edge function with valid auth token */
async function invokeAdminUsers(body: object) {
  const token = await getAuthToken();
  return supabase.functions.invoke('admin-users', {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── useAllUsers Hook (Single cached fetch for the school) ──────────────────
export function useAllUsers() {
  const { user, session } = useAuth();

  return useQuery({
    queryKey: ['admin-users', 'all', user?.schoolId, user?.isSuperAdmin],
    queryFn: async (): Promise<UserProfile[]> => {
      let query = supabase
        .from('profiles')
        .select('id, full_name, email, phone, school_id, created_at, updated_at, user_roles(role, approval_status, school_id, is_super_admin)');

      if (!user?.isSuperAdmin && user?.schoolId) {
        query = query.eq('school_id', user.schoolId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      const transformedData = (data || []).map((item: any) => ({
        id: item.id,
        user_id: item.id,
        school_id: item.user_roles?.[0]?.school_id || item.school_id,
        full_name: item.full_name,
        fullName: item.full_name,
        email: item.email,
        phone: item.phone,
        role: item.user_roles?.[0]?.role || 'parent',
        status: item.user_roles?.[0]?.approval_status || 'pending',
        approvalStatus: item.user_roles?.[0]?.approval_status || 'pending',
        avatar_url: item.avatar_url || null,
        created_at: item.created_at,
        createdAt: item.created_at,
        updated_at: item.updated_at,
      }));

      return transformedData as UserProfile[];
    },
    enabled: !!session && (user?.role === 'admin' || user?.isSuperAdmin === true),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

// ─── useUsers Hook (Instant in-memory 0ms search & filter) ──────────────────
export function useUsers(page: number = 1, pageSize: number = 20, search: string = '', roleFilter: string = '') {
  const allUsersQuery = useAllUsers();
  const allUsers = allUsersQuery.data || [];

  const filteredData = useMemo(() => {
    if (!allUsers.length) return { data: [], count: 0 };

    const cleanSearch = search.trim();
    const cleanPhone = cleanSearch.replace(/\D/g, '');

    const filtered = allUsers.filter((u) => {
      // 1. Role Filter
      if (roleFilter && roleFilter !== 'الكل') {
        if (u.role !== roleFilter) return false;
      }

      // 2. Instant Arabic Search & Phone/Email Match
      if (cleanSearch) {
        const nameMatch = matchesArabic(u.full_name, cleanSearch);
        const phoneMatch = cleanPhone.length >= 3 && Boolean(u.phone && u.phone.includes(cleanPhone));
        const emailMatch = Boolean(u.email && u.email.toLowerCase().includes(cleanSearch.toLowerCase()));
        if (!nameMatch && !phoneMatch && !emailMatch) return false;
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
  }, [allUsers, page, pageSize, search, roleFilter]);

  return {
    ...allUsersQuery,
    data: filteredData,
  };
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userData: Partial<UserProfile>) => {
      const { data, error } = await invokeAdminUsers({ action: 'create_user', data: userData });

      if (error) throw new Error(error.message || 'Failed to create user');
      if (!data?.success) throw new Error(data?.error || 'Failed to create user');

      await (supabase as any).rpc('log_action', {
        p_action: 'CREATE_USER',
        p_entity_type: 'profiles',
        p_entity_id: data.userId,
        p_details: `إنشاء مستخدم جديد: ${userData.full_name}`,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['teachers'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['parents'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'], exact: false });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      logger.log('[Delete User] Starting deletion for:', userId);

      const { data, error } = await invokeAdminUsers({ action: 'delete', userId });

      logger.log('[Delete User] Response:', { data, error });

      if (error) {
        logger.error('[Delete User] Function error:', error);
        throw new Error(error.message || 'فشل في حذف المستخدم');
      }

      if (!data?.success) {
        logger.error('[Delete User] Unsuccessful:', data);
        throw new Error(data?.error || 'فشل في حذف المستخدم');
      }

      logger.log('[Delete User] Success!');

      await (supabase as any).rpc('log_action', {
        p_action: 'DELETE_USER',
        p_entity_type: 'profiles',
        p_entity_id: userId,
        p_details: 'حذف مستخدم نهائياً من النظام',
      });

      return userId;
    },
    onSuccess: () => {
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] === 'admin-users' && query.queryKey.length > 0,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-users'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['students'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['teachers'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['parents'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'], exact: false });
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { data, error } = await invokeAdminUsers({ action: 'update_role', userId, data: { role } });

      if (error) throw new Error(error.message || 'فشل في تحديث الرتبة');
      if (!data?.success) throw new Error('فشل في تحديث الرتبة');

      await (supabase as any).rpc('log_action', {
        p_action: 'UPDATE_USER_ROLE',
        p_entity_type: 'user_roles',
        p_entity_id: userId,
        p_details: `تحديث رتبة المستخدم إلى: ${role}`,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['teachers'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['parents'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'], exact: false });
    },
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: 'approved' | 'rejected' }) => {
      const { data, error } = await invokeAdminUsers({ action: 'update_status', userId, data: { status } });

      if (error) throw new Error(error.message || 'Failed to update user status');
      if (!data?.success) throw new Error(data?.error || 'Failed to update user status');

      await (supabase as any).rpc('log_action', {
        p_action: 'UPDATE_USER_STATUS',
        p_entity_type: 'user_roles',
        p_entity_id: userId,
        p_details: `تحديث حالة الحساب إلى: ${status === 'approved' ? 'مفعل' : 'مرفوض'}`,
      });

      return { userId, status };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['teachers'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['parents'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'], exact: false });
    },
  });
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: Partial<UserProfile> }) => {
      const { data, error } = await invokeAdminUsers({ action: 'update_profile', userId, data: updates });

      if (error) throw new Error(error.message || 'فشل في تحديث البيانات');
      if (!data?.success) throw new Error('فشل في تحديث البيانات');

      await (supabase as any).rpc('log_action', {
        p_action: 'UPDATE_USER_PROFILE',
        p_entity_type: 'profiles',
        p_entity_id: userId,
        p_details: 'تحديث بيانات الملف الشخصي للمستخدم',
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['teachers'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['parents'], exact: false });
    },
  });
}
