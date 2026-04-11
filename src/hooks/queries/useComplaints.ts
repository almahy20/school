import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

export function useComplaints(page = 1, pageSize = 15, search = '', status = 'الكل') {
  const { user } = useAuth();
  const queryKey = ['complaints', user?.schoolId, user?.isSuperAdmin, page, pageSize, search, status];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.schoolId && !user?.isSuperAdmin) return { data: [], count: 0 };
      
      let q = supabase.from('complaints').select('*', { count: 'exact' });

      if (!user?.isSuperAdmin && user?.schoolId) {
        q = q.eq('school_id', user.schoolId);
      }

      if (status !== 'الكل') {
        q = q.eq('status', status);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data: complaintsData, error, count } = await q
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Get parent names separately
      const parentIds = (complaintsData || []).map(c => c.parent_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', parentIds);

      // Get student names separately
      const studentIds = (complaintsData || []).map(c => c.student_id).filter(Boolean);
      const { data: students } = await supabase
        .from('students')
        .select('id, name')
        .in('id', studentIds);

      const data = (complaintsData || []).map((c: any) => ({
        ...c,
        parent_name: profiles?.find(p => p.id === c.parent_id)?.full_name || 'ولي أمر',
        student_name: students?.find(s => s.id === c.student_id)?.name || 'غير محدد',
      })) as Complaint[];

      return { data, count: count || 0 };
    },
    enabled: !!(user?.schoolId || user?.isSuperAdmin),
    staleTime: 15 * 1000, // ⚡ 15 seconds (was 30s)
    gcTime: 5 * 60 * 1000, // ⚡ 5 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    placeholderData: keepPreviousData,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 5000),
  });
}

export function useParentComplaints(page = 1, pageSize = 10) {
  const { user } = useAuth();
  const queryKey = ['parent-complaints', user?.id, user?.schoolId, page, pageSize];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.id || !user?.schoolId) return { data: [], count: 0 };
      
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('complaints')
        .select('*', { count: 'exact' })
        .eq('school_id', user.schoolId)
        .eq('parent_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { data: data as Complaint[], count: count || 0 };
    },
    enabled: !!(user?.id && user?.schoolId),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
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
         query = supabase.from('complaints').update({ ...dbPayload }).eq('id', dbPayload.id);
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
