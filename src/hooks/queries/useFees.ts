import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface FeeRecord {
  id: string;
  student_id: string | null;
  amount_due: number;
  amount_paid: number;
  status: string | null;
  term: string;
  school_id: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export function useFees(term?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['fees', user?.schoolId, term],
    queryFn: async () => {
      if (!user?.schoolId) return [];
      let query = supabase
        .from('fees')
        .select('*')
        .eq('school_id', user.schoolId);
      
      if (term) {
        query = query.eq('term', term);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as FeeRecord[];
    },
    enabled: !!user?.schoolId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpsertFee() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (record: Partial<FeeRecord> & { student_id: string; term: string }) => {
      const { data, error } = await supabase
        .from('fees')
        .upsert({
          ...record,
          school_id: record.school_id || user?.schoolId
        }, { onConflict: 'student_id,term' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fees', user?.schoolId, data.term] });
      queryClient.invalidateQueries({ queryKey: ['parent-children'] });
      queryClient.invalidateQueries({ queryKey: ['child-full-details'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });
}

export function useGenerateFees() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ students, term, amount }: { students: any[], term: string, amount: number }) => {
      if (!user?.schoolId) throw new Error('No school ID');
      
      const records = students.map(s => ({
        student_id: s.id,
        school_id: user.schoolId,
        term,
        amount_due: amount,
        amount_paid: 0,
        status: 'unpaid'
      }));

      const { error } = await supabase.from('fees').upsert(records, { onConflict: 'student_id,term' });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fees', user?.schoolId, variables.term] });
    },
  });
}
