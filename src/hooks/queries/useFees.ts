import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
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

export function useFees(term?: string, page = 1, pageSize = 15, search = '', classId = 'all') {
  const { user } = useAuth();
  const queryKey = ['fees', user?.schoolId, term, page, pageSize, search, classId];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.schoolId) return { data: [], count: 0, stats: { total_due: 0, total_paid: 0 } };

      // 1. Get all students with their fixed monthly fee
      let studentsQ = supabase
        .from('students')
        .select('id, name, monthly_fee, class_id, classes(id, name)', { count: 'exact' })
        .eq('school_id', user.schoolId);

      if (search) studentsQ = studentsQ.ilike('name', `%${search}%`);
      if (classId !== 'all') studentsQ = studentsQ.eq('class_id', classId);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data: students, error: sErr, count } = await studentsQ
        .order('name')
        .range(from, to);

      if (sErr) throw sErr;

      // 2. Get fee payments for the selected term
      const studentIds = (students || []).map(s => s.id);
      const { data: monthFees, error: fErr } = await supabase
        .from('fees')
        .select('*')
        .eq('school_id', user.schoolId)
        .eq('term', term)
        .in('student_id', studentIds);

      if (fErr) throw fErr;

      // 3. Calculate Global Stats for this term (for all students in school/class)
      // Note: We need another query to get total due/paid for ALL students, not just current page
      let allStudentsQ = supabase
        .from('students')
        .select('id, monthly_fee')
        .eq('school_id', user.schoolId);
      if (classId !== 'all') allStudentsQ = allStudentsQ.eq('class_id', classId);
      const { data: allStudents } = await allStudentsQ;

      let allFeesQ = supabase
        .from('fees')
        .select('amount_paid')
        .eq('school_id', user.schoolId)
        .eq('term', term);
      // If we want stats for a specific class, we'd need a join or a list of IDs
      // For simplicity and performance, let's use the allStudents list if classId is not 'all'
      if (classId !== 'all' && allStudents) {
        allFeesQ = allFeesQ.in('student_id', allStudents.map(s => s.id));
      }
      const { data: allTermFees } = await allFeesQ;

      const total_due = (allStudents || []).reduce((sum, s) => sum + (Number(s.monthly_fee) || 0), 0);
      const total_paid = (allTermFees || []).reduce((sum, f) => sum + (Number(f.amount_paid) || 0), 0);

      // 4. Enrich student data
      const enrichedData = (students || []).map((s: any) => {
        const feeRecord = (monthFees || []).find(f => f.student_id === s.id);
        
        const amount_due = Number(s.monthly_fee) || 0;
        const amount_paid = Number(feeRecord?.amount_paid) || 0;
        
        let status = 'unpaid';
        if (amount_due > 0) {
          if (amount_paid >= amount_due) status = 'paid';
          else if (amount_paid > 0) status = 'partial';
        }

        return {
          ...s,
          fee: {
            id: feeRecord?.id,
            amount_due,
            amount_paid,
            status,
            term
          }
        };
      });

      return { 
        data: enrichedData, 
        count: count || 0, 
        stats: { total_due, total_paid } 
      };
    },
    enabled: !!user?.schoolId,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateStudentMonthlyFee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ studentId, amount }: { studentId: string; amount: number }) => {
      const { error } = await supabase
        .from('students')
        .update({ monthly_fee: amount })
        .eq('id', studentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديث المطالبة المالية الثابتة للطالب');
      queryClient.invalidateQueries({ queryKey: ['fees'] });
    },
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
        const { error } = await supabase
          .from('fees')
          .update({
            amount_paid: record.amount_paid,
            status: record.status,
            school_id: record.school_id || user?.schoolId
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        // 3. Insert new
        const { error } = await supabase
          .from('fees')
          .insert({
            student_id: record.student_id,
            term: record.term,
            amount_due: record.amount_due || 0, // This will be the snapshot of monthly_fee
            amount_paid: record.amount_paid || 0,
            status: record.status || 'unpaid',
            school_id: record.school_id || user?.schoolId
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('تم تسجيل الدفعة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['fees'] });
    },
  });
}

export function useGenerateFees() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ amount, classId }: { amount: number; classId: string; term?: string }) => {
      if (!user?.schoolId) return;

      // Update monthly_fee for all students in class (or school)
      let q = supabase
        .from('students')
        .update({ monthly_fee: amount })
        .eq('school_id', user.schoolId);

      if (classId !== 'all') {
        q = q.eq('class_id', classId);
      }
      
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديث المطالبة الثابتة لجميع الطلاب بنجاح');
      queryClient.invalidateQueries({ queryKey: ['fees'] });
    },
  });
}

export function useClearTermFees() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (term: string) => {
      if (!user?.schoolId || !term) return;

      const { error } = await supabase
        .from('fees')
        .delete()
        .eq('school_id', user.schoolId)
        .eq('term', term);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تصفير سجلات هذا الشهر بنجاح');
      queryClient.invalidateQueries({ queryKey: ['fees'] });
    },
  });
}
