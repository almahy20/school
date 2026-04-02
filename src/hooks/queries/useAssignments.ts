import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Assignment {
  id: string;
  title: string;
  description: string;
  class_id: string;
  teacher_id: string;
  school_id: string;
  due_date: string;
  created_at: string;
  class_name?: string;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  status: 'submitted' | 'graded' | 'late';
  file_url: string | null;
  grade: number | null;
  feedback: string | null;
  submitted_at: string;
  student_name?: string;
}

export function useAssignments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['assignments', user?.schoolId, user?.role, user?.id],
    queryFn: async () => {
      let q = supabase
        .from('assignments')
        .select(`
          *,
          classes ( name )
        `)
        .order('created_at', { ascending: false });

      if (!user?.isSuperAdmin && user?.schoolId) {
        q = q.eq('school_id', user.schoolId);
      }

      // If user is a teacher, maybe we want to filter assignments created by them?
      // Or show all assignments for their school? Let's show all for their school,
      // but maybe assignments are usually created by teachers of specific classes.
      // We will rely on RLS to filter what they can see.

      const { data, error } = await q;

      if (error) throw error;

      return (data || []).map((a: any) => ({
        ...a,
        class_name: a.classes?.name || 'غير معروف',
      })) as Assignment[];
    },
    enabled: !!(user?.schoolId || user?.isSuperAdmin),
  });
}

export function useSubmissions(assignmentId: string) {
  return useQuery({
    queryKey: ['submissions', assignmentId],
    queryFn: async () => {
      if (!assignmentId) return [];
      
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          *,
          students ( full_name )
        `)
        .eq('assignment_id', assignmentId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((s: any) => ({
        ...s,
        student_name: s.students?.full_name || 'غير معروف',
      })) as Submission[];
    },
    enabled: !!assignmentId,
  });
}

export function useCreateAssignment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (newAssignment: Partial<Assignment>) => {
      const { data, error } = await supabase
        .from('assignments')
        .insert([{
          ...newAssignment,
          school_id: user?.schoolId,
          teacher_id: user?.id,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments', user?.schoolId] });
    },
  });
}

export function useDeleteAssignment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assignments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments', user?.schoolId] });
    },
  });
}
