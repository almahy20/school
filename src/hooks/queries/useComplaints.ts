import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
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
  const { user, session } = useAuth();
  const queryKey = ['complaints', user?.schoolId, user?.isSuperAdmin, page, pageSize, search, status];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.schoolId && !user?.isSuperAdmin) return { data: [], count: 0 };
      
      let q = supabase
        .from('complaints')
        .select(`
          *,
          parent:profiles(full_name),
          student:students(name)
        `, { count: 'exact' });

      if (!user?.isSuperAdmin && user?.schoolId) {
        q = q.eq('school_id', user.schoolId);
      }

      if (status !== 'الكل') {
        q = q.eq('status', status);
      }

      if (search) {
        q = q.ilike('content', `%${search}%`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data: complaintsData, error, count } = await q
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const data = (complaintsData || []).map((c: any) => ({
        ...c,
        parent_name: (c.parent as any)?.full_name || 'ولي أمر',
        student_name: (c.student as any)?.name || 'غير محدد',
      })) as Complaint[];

      return { data, count: count || 0 };
    },
    enabled: !!session && !!(user?.schoolId || user?.isSuperAdmin),
    placeholderData: keepPreviousData,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    retryDelay: 1000,
  });
}

export function useParentComplaints(page = 1, pageSize = 10) {
  const { user, session } = useAuth();
  const queryKey = ['parent-complaints', user?.id, user?.schoolId, page, pageSize];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.id || !user?.schoolId) return { data: [], count: 0 };
      
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('complaints')
        .select('id, parent_id, student_id, content, status, created_at, school_id, admin_response', { count: 'exact' })
        .eq('school_id', user.schoolId)
        .eq('parent_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { data: (data || []) as Complaint[], count: count || 0 };
    },
    enabled: !!session && !!(user?.id && user?.schoolId),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
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
    onSuccess: (result: any) => {
      toast.success('تم حفظ الشكوى بنجاح');
      queryClient.invalidateQueries({ queryKey: ['complaints'], exact: false });
      if (result?.parent_id) {
        queryClient.invalidateQueries({ queryKey: ['parent-complaints', result.parent_id] });
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
      return id;
    },
    onSuccess: () => {
      toast.success('تم حذف الشكوى بنجاح');
      queryClient.invalidateQueries({ queryKey: ['complaints'], exact: false });
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
      toast.success('تم إرسال الشكوى بنجاح');
      queryClient.invalidateQueries({ queryKey: ['complaints'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['parent-complaints'] });
    },
  });
}
