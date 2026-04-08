import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';

export interface FeeRecord {
  id: string;
  student_id: string | null;
  amount_due: number;
  amount_paid: number;
  status: string | null;
  term: string;
  school_id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export function useFees(term?: string) {
  const { user } = useAuth();
  const queryKey = useMemo(() => ['fees', user?.schoolId, term], [user?.schoolId, term]);
  
  return useQuery({
    queryKey,
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
    staleTime: 0,
    refetchInterval: 15 * 1000,
  });
}

export function useUpsertFee() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (record: Partial<FeeRecord> & { student_id: string; term: string }) => {
      // 1. Try to find existing record for this student and term
      const { data: existing } = await supabase
        .from('fees')
        .select('id')
        .eq('student_id', record.student_id)
        .eq('term', record.term)
        .maybeSingle();

      if (existing) {
        // 2. Update existing
        const { data, error } = await supabase
          .from('fees')
          .update({
            amount_due: record.amount_due,
            amount_paid: record.amount_paid,
            status: record.status,
            term: record.term,
            school_id: record.school_id || user?.schoolId
          })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        // 3. Insert new
        const { data, error } = await supabase
          .from('fees')
          .insert({
            student_id: record.student_id,
            term: record.term,
            amount_due: record.amount_due || 0,
            amount_paid: record.amount_paid || 0,
            status: record.status || 'unpaid',
            school_id: record.school_id || user?.schoolId
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
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
      
      // 1. Fetch existing records for this term to avoid duplicates
      const { data: existingRecords } = await supabase
        .from('fees')
        .select('student_id')
        .eq('term', term)
        .eq('school_id', user.schoolId);

      const existingStudentIds = new Set(existingRecords?.map(r => r.student_id) || []);
      
      // 2. Only create records for students who don't have one
      const recordsToInsert = students
        .filter(s => !existingStudentIds.has(s.id))
        .map(s => ({
          student_id: s.id,
          school_id: user.schoolId,
          term,
          amount_due: amount,
          amount_paid: 0,
          status: 'unpaid'
        }));

      if (recordsToInsert.length === 0) return;

      const { error } = await supabase.from('fees').insert(recordsToInsert);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fees', user?.schoolId, variables.term] });
    },
  });
}
