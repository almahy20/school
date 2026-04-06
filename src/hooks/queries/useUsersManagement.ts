import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppRole } from '@/types/auth';

export interface ManagedUser {
  id: string;
  fullName: string;
  phone: string;
  role: AppRole;
  banned: boolean;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

async function callAdminApi(action: string, userId?: string, data?: Record<string, unknown>) {
  try {
    const { data: res, error } = await supabase.functions.invoke('admin-users', {
      body: { action, userId, data },
    });
    if (error) {
      console.error('[AdminAPI Error]', error);
      return { error: error.message || 'Network error calling Admin API' };
    }
    return res;
  } catch (err: any) {
    console.error('[AdminAPI Exception]', err);
    return { error: err.message || 'Exception calling Admin API' };
  }
}

export function useUsers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['managed-users', user?.schoolId, user?.isSuperAdmin],
    queryFn: async () => {
      if (!user?.isSuperAdmin && !user?.schoolId) return [];
      
      const profileQuery = supabase.from('profiles').select('*');
      const roleQuery = supabase.from('user_roles').select('*');
      
      if (!user?.isSuperAdmin && user?.schoolId) {
        profileQuery.eq('school_id', user.schoolId);
        roleQuery.eq('school_id', user.schoolId);
      }

      const [{ data: profiles }, { data: roles }, authData] = await Promise.all([
        profileQuery,
        roleQuery,
        callAdminApi('list').catch(err => ({ error: err.message, users: [] }))
      ]);

      const authUsers = authData?.users || [];
      const merged: ManagedUser[] = (profiles || []).map((p) => {
        const userRole = (roles || []).find((r) => r.user_id === p.id);
        const authUser = authUsers.find((u: any) => u.id === p.id);
        return {
          id: p.id,
          fullName: p.full_name || '',
          phone: p.phone || '',
          role: (userRole?.role as AppRole) || 'parent',
          banned: !!authUser?.banned_until && new Date(authUser.banned_until) > new Date(),
          approvalStatus: (userRole as any)?.approval_status || 'approved',
          createdAt: p.created_at,
        };
      });
      return merged;
    },
    enabled: !!(user?.schoolId || user?.isSuperAdmin),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (userData: any) => {
      return await callAdminApi('create', undefined, { 
        ...userData, 
        schoolId: user?.schoolId 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-users'] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      return await callAdminApi('delete', userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-users'] });
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      return await callAdminApi('update-role', userId, { 
        role, 
        schoolId: user?.schoolId 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-users'] });
    },
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: ManagedUser['approvalStatus'] }) => {
      const { error } = await supabase
        .from('user_roles')
        .update({ approval_status: status } as any)
        .eq('user_id', userId);
      if (error) throw error;
      return { userId, status };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-users'] });
    },
  });
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, ...updates }: { userId: string; full_name?: string; phone?: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);
      if (error) throw error;
      return { userId, updates };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-users'] });
    },
  });
}
