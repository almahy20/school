import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Grade {
  id: string;
  student_id: string;
  subject: string;
  exam_type: string;
  score: number;
  max_score: number;
  school_id: string | null;
  class_id: string | null;
  created_at: string;
  students?: { name: string };
  classes?: { name: string };
}

async function fetchGrades(schoolId: string | null, isSuperAdmin: boolean): Promise<Grade[]> {
  const q = supabase.from('grades').select('*, students(name), classes(name)');
  if (!isSuperAdmin && schoolId) {
    q.eq('school_id', schoolId);
  }
  const { data, error } = await q.order('created_at', { ascending: false }).limit(300);
  if (error) throw error;
  return (data as Grade[]) || [];
}

export function useGrades() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['grades', user?.schoolId],
    queryFn: () => fetchGrades(user?.schoolId || null, !!user?.isSuperAdmin),
    enabled: !!(user?.schoolId || user?.isSuperAdmin),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useAddGrade() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (grade: Omit<Grade, 'id' | 'created_at' | 'students' | 'classes'>) => {
      const { data, error } = await supabase.from('grades').insert(grade).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades', user?.schoolId] });
    },
  });
}

export function useDeleteGrade() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (gradeId: string) => {
      const { error } = await supabase.from('grades').delete().eq('id', gradeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades', user?.schoolId] });
    },
  });
}
