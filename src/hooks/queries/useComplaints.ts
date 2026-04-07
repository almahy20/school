import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeSync } from '../useRealtimeSync';

export interface Complaint {
  id: string;
  parent_id: string;
  student_id: string | null;
  content: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'processing';
  created_at: string;
  school_id: string;
  admin_response?: string | null;
  parent_name?: string;
  student_name?: string;
}

export function useComplaints() {
  const { user } = useAuth();
  const queryKey = ['complaints', user?.schoolId, user?.isSuperAdmin];
  useRealtimeSync('complaints', queryKey, user?.isSuperAdmin ? undefined : `school_id=eq.${user?.schoolId}`);

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.schoolId && !user?.isSuperAdmin) return [];
      
      const query = supabase.from('complaints').select(`
        *,
        students:students!complaints_student_id_fkey(name)
      `).order('created_at', { ascending: false });

      if (!user?.isSuperAdmin && user?.schoolId) {
        query.eq('school_id', user.schoolId);
      }

      const { data: complaintsData, error } = await query;
      if (error) throw error;

      // Extract unique parent IDs for enrichment
      const parentIds = [...new Set(complaintsData.map((c: any) => c.parent_id))].filter(Boolean) as string[];
      
      let profiles: any[] = [];
      if (parentIds.length > 0) {
        const profilesQuery = supabase.from('profiles').select('id, full_name');
        if (!user?.isSuperAdmin && user?.schoolId) {
          profilesQuery.eq('school_id', user.schoolId);
        }
        const { data } = await profilesQuery.in('id', parentIds);
        profiles = data || [];
      }

      return (complaintsData || []).map((c: any) => ({
        ...c,
        parent_name: profiles?.find(p => p.id === c.parent_id)?.full_name || 'ولي أمر',
        student_name: c.students?.name || 'غير محدد',
      })) as Complaint[];
    },
    enabled: !!(user?.schoolId || user?.isSuperAdmin),
    staleTime: 0,
    refetchInterval: 15 * 1000,
  });
}

export function useParentComplaints() {
  const { user } = useAuth();
  const queryKey = ['parent-complaints', user?.id, user?.schoolId];
  useRealtimeSync('complaints', queryKey, user?.id ? `parent_id=eq.${user?.id}` : undefined);

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.id || !user?.schoolId) return [];
      const { data, error } = await supabase
        .from('complaints')
        .select('*')
        .eq('school_id', user.schoolId)
        .eq('parent_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Complaint[];
    },
    enabled: !!(user?.id && user?.schoolId),
    staleTime: 0,
    refetchInterval: 15 * 1000,
  });
}

export function useUpsertComplaint() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (complaint: any) => {
      // Strip UI helper fields
      const { 
        parent_name, 
        student_name, 
        students, 
        parent_id, 
        ...rest 
      } = complaint;
      
      const dbPayload: any = { ...rest };
      
      if (parent_id || (rest as any).user_id) {
         dbPayload.parent_id = parent_id || (rest as any).user_id;
      }
      
      if (user?.schoolId) {
         dbPayload.school_id = user.schoolId;
      }

      let query;
      if (dbPayload.id) {
         query = supabase.from('complaints').update(dbPayload).eq('id', dbPayload.id);
      } else {
         query = supabase.from('complaints').insert(dbPayload);
      }

      const { data, error } = await query.select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['complaints', user?.schoolId] });
      if (data?.parent_id) {
        queryClient.invalidateQueries({ queryKey: ['parent-complaints', data.parent_id] });
      }
    },
  });
}

export function useDeleteComplaint() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('complaints').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints', user?.schoolId] });
      queryClient.invalidateQueries({ queryKey: ['parent-complaints'] });
    },
  });
}

export function useCreateComplaint() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ studentId, content }: { studentId: string; content: string }) => {
      if (!user?.schoolId) throw new Error('School ID not found');
      
      const { data, error } = await supabase
        .from('complaints')
        .insert({
          parent_id: user.id,
          student_id: studentId,
          content: content.trim(),
          school_id: user.schoolId,
          status: 'pending'
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      queryClient.invalidateQueries({ queryKey: ['parent-complaints', user?.id] });
    },
  });
}
