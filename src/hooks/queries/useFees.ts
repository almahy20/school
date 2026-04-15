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

      // ─── جلب الإحصائيات (الكل لهذا الترم والمدرسة) ───
      let statsQ = supabase
        .from('fees')
        .select('amount_due, amount_paid')
        .eq('school_id', user.schoolId);
      if (term) statsQ = statsQ.eq('term', term); // ✅ إعادة تعيين النتيجة
      const { data: allFees } = await statsQ;
      
      const total_due  = (allFees || []).reduce((sum, f) => sum + (Number(f.amount_due)  || 0), 0);
      const total_paid = (allFees || []).reduce((sum, f) => sum + (Number(f.amount_paid) || 0), 0);

      // ─── جلب القائمة (مجزأة) ───
      // نستخدم الطلاب كنقطة انطلاق ثم ننضم مع الرسوم لهذا الترم
      let q = supabase
        .from('students')
        .select('*, classes(id, name), fees!left(*)', { count: 'exact' })
        .eq('school_id', user.schoolId);

      if (term) {
        q = q.eq('fees.term', term);
      }
      if (search) {
        q = q.ilike('name', `%${search}%`);
      }
      if (classId !== 'all') {
        q = q.eq('class_id', classId);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await q
        .order('name')
        .range(from, to);

      if (error) throw error;

      // ننسق البيانات لتشبه الهيكل المتوقع في الواجهة
      const enrichedData = (data || []).map((s: any) => ({
        ...s,
        fee: Array.isArray(s.fees) ? s.fees[0] : s.fees
      }));

      return { 
        data: enrichedData, 
        count: count || 0, 
        stats: { total_due, total_paid } 
      };
    },
    enabled: !!user?.schoolId,
    placeholderData: keepPreviousData,
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
            amount_due: record.amount_due,
            amount_paid: record.amount_paid,
            status: record.status,
            term: record.term,
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
            amount_due: record.amount_due || 0,
            amount_paid: record.amount_paid || 0,
            status: record.status || 'unpaid',
            school_id: record.school_id || user?.schoolId
          });
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      toast.success('تم حفظ الرسوم بنجاح');
      queryClient.invalidateQueries({ queryKey: ['fees', user?.schoolId, variables.term] });
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
