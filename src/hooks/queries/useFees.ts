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
    staleTime: 5 * 60 * 1000,
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
    onSuccess: () => {
      toast.success('تم تحديث بيانات الرسوم بنجاح');
      queryClient.invalidateQueries({ queryKey: ['fees'] });
    },
  });
}

export function useGenerateFees() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ term, classId, amount }: { term: string; classId: string; amount: number }) => {
      if (!user?.schoolId) return;

      // 1. Get all students in the class (or all students in school if classId is 'all')
      let q = supabase.from('students').select('id').eq('school_id', user.schoolId);
      if (classId !== 'all') {
        q = q.eq('class_id', classId);
      }
      
      const { data: students, error: sErr } = await q;
      if (sErr) throw sErr;
      if (!students || students.length === 0) return;

      // 2. For each student, insert a fee record if it doesn't exist for this term
      const operations = students.map(async (s) => {
        const { data: existing } = await supabase
          .from('fees')
          .select('id')
          .eq('student_id', s.id)
          .eq('term', term)
          .maybeSingle();

        if (!existing) {
          return supabase.from('fees').insert({
            student_id: s.id,
            term: term,
            amount_due: amount,
            amount_paid: 0,
            status: 'unpaid',
            school_id: user.schoolId
          });
        }
      });

      await Promise.all(operations);
    },
    onSuccess: () => {
      toast.success('تم توليد الرسوم بنجاح');
      queryClient.invalidateQueries({ queryKey: ['fees'] });
    },
  });
}
