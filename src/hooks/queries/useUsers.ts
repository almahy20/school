import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Types
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

/**
 * Hook to get all users (admin only)
 */
export function useUsers(page: number = 1, pageSize: number = 20, search: string = '', roleFilter: string = '') {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['admin-users', page, pageSize, search, roleFilter],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('*, user_roles(role, approval_status, school_id, is_super_admin)', { count: 'exact' });

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
      }

      if (roleFilter) {
        query = query.eq('user_roles.role', roleFilter);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .range(from, to)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform data to match UserProfile interface
      const transformedData = (data || []).map((item: any) => ({
        id: item.id,
        user_id: item.id,
        school_id: item.user_roles?.[0]?.school_id || item.school_id,
        full_name: item.full_name,
        email: item.email,
        phone: item.phone,
        role: item.user_roles?.[0]?.role || 'parent',
        status: item.user_roles?.[0]?.approval_status || 'pending',
        avatar_url: item.avatar_url || null,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));
      
      return { data: transformedData as UserProfile[], count: count || 0 };
    },
    // Only fetch for admin users
    enabled: user?.role === 'admin' || user?.isSuperAdmin === true,
  });
}

/**
 * Hook to create a new user
 */
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userData: Partial<UserProfile>) => {
      const { data, error } = await supabase
        .from('user_profiles')
        .insert(userData)
        .select()
        .single();

      if (error) throw error;
      return data as UserProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}

/**
 * Hook to delete a user
 */
export function useDeleteUser() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (userId: string) => {
      console.log('[Delete User] Starting deletion for:', userId);
      
      // Use the admin-users edge function for complete deletion
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'delete', userId },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      console.log('[Delete User] Response:', { data, error });

      if (error) {
        console.error('[Delete User] Function error:', error);
        throw new Error(error.message || 'فشل في حذف المستخدم');
      }
      
      if (!data?.success) {
        console.error('[Delete User] Unsuccessful:', data);
        throw new Error(data?.error || 'فشل في حذف المستخدم');
      }
      
      console.log('[Delete User] Success!');
      return userId;
    },
    onSuccess: (userId) => {
      // Remove the deleted user from ALL admin-users queries in cache
      queryClient.removeQueries({ 
        predicate: (query) => 
          query.queryKey[0] === 'admin-users' && query.queryKey.length > 0
      });
      
      // Force refetch
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

/**
 * Hook to update user role
 */
export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'update_role', userId, data: { role } },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw new Error(error.message || 'فشل في تحديث الرتبة');
      if (!data?.success) throw new Error('فشل في تحديث الرتبة');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}

/**
 * Hook to update user status (approve/reject)
 */
export function useUpdateUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: 'approved' | 'rejected' }) => {
      const { error } = await supabase
        .from('user_roles')
        .update({ approval_status: status })
        .eq('user_id', userId);

      if (error) throw error;
      return { userId, status };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}

/**
 * Hook to update user profile
 */
export function useUpdateUserProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: Partial<UserProfile> }) => {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'update_profile', userId, data: updates },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw new Error(error.message || 'فشل في تحديث البيانات');
      if (!data?.success) throw new Error('فشل في تحديث البيانات');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
}
