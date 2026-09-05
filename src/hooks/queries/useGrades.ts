import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ExamTemplate {
  id: string;
  class_id: string;
  subject: string;
  exam_type: string;
  max_score: number;
  weight: number;
  term: string;
  title: string;
  teacher_id: string;
  created_at: string;
  school_id: string;
  score_type?: 'numeric' | 'text';
  expected_results?: string[];
}

export interface StudentGrade {
  studentId: string;
  studentName: string;
  score: string;
  gradeId?: string;
}

export function useExamTemplates(classId: string | null, subject: string | null, page = 1, pageSize = 10) {
  const { user, session } = useAuth();
  const queryKey = ['exam-templates', user?.schoolId, classId, subject, page, pageSize];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.schoolId || !classId) return { data: [], count: 0 };
      
      // نحاول أولاً بالـ select الكامل
      // لو رجع 42703 (column does not exist) نعيد بـ select أدنى
      const selectFull = 'id, class_id, subject, exam_type, max_score, weight, term, title, teacher_id, created_at, school_id, score_type, expected_results';
      const selectMinimal = 'id, class_id, subject, term, created_at, school_id';

      const from = (page - 1) * pageSize;

      const runQuery = async (selectStr: string) => {
        let q: any = supabase
          .from('exam_templates')
          .select(selectStr, { count: 'exact' })
          .eq('school_id', user.schoolId)
          .eq('class_id', classId);
        if (subject) q = q.eq('subject', subject);
        return q.order('created_at', { ascending: false }).range(from, from + pageSize - 1);
      };

      let { data, error, count } = await runQuery(selectFull);

      // 42703 = column does not exist — الـ production database ناقص أعمدة
      if (error && error.code === '42703') {
        const fallback = await runQuery(selectMinimal);
        data  = fallback.data;
        error = fallback.error;
        count = fallback.count;
      }

      if (error) throw error;
      return { data: (data as ExamTemplate[]) || [], count: count || 0 };
    },
    enabled: !!session && !!(user?.schoolId && classId),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 1,
    retryDelay: 1000,
  });
}

export function useStudentGrades(template: any | null, classId: string | null) {
  const { user, session } = useAuth();
  const templateId = template?.id;
  const queryKey = ['student-grades', templateId, classId];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.schoolId || !classId || !templateId) return [];
      
      // Optimized: Single query with JOIN instead of two separate queries
      const { data: studentsWithGrades, error } = await supabase
        .from('students')
        .select(`
          id,
          name,
          grades!grades_student_id_fkey(
            id,
            score,
            exam_template_id,
            subject,
            term
          )
        `)
        .eq('school_id', user.schoolId)
        .eq('class_id', classId)
        .order('name')
        .limit(200); // فصل دراسي — 200 طالب أقصى حد معقول
      
      if (error) throw error;
      if (!studentsWithGrades?.length) return [];

      // Transform data to match expected format
      return studentsWithGrades.map(s => {
        const grade = Array.isArray(s.grades) 
          ? s.grades.find((g: any) => 
              g.exam_template_id === templateId || 
              (!g.exam_template_id && g.subject === template?.subject && g.term === (template?.term || template?.title))
            )
          : s.grades;
        
        return {
          studentId: s.id,
          studentName: s.name,
          score: grade ? String(grade.score) : '',
          gradeId: grade?.id,
        };
      }) as StudentGrade[];
    },
    enabled: !!session && !!(user?.schoolId && classId && templateId),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateExamTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (template: Omit<ExamTemplate, 'id' | 'created_at' | 'school_id'>) => {
      if (!user?.schoolId) throw new Error('School ID is missing');
      const { data, error } = await supabase
        .from('exam_templates')
        .insert({ ...template, school_id: user.schoolId, teacher_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-templates'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });
}

export function useDeleteExamTemplate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (templateId: string) => {
      // Cascade delete grades if not handled by FK
      await supabase.from('grades').delete().eq('exam_template_id', templateId);
      const { error } = await supabase.from('exam_templates').delete().eq('id', templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-templates'] });
      queryClient.invalidateQueries({ queryKey: ['student-grades'] });
      queryClient.invalidateQueries({ queryKey: ['student-grades-full'] });
      queryClient.invalidateQueries({ queryKey: ['child-full-details'] });
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['parent-children'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });
}

export function useUpsertGrades() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (grades: any[]) => {
      if (!grades.length) return;
      const templateId = grades[0].exam_template_id;

      // Clean id and prepare grades with school context
      const cleanedGrades = grades.map(({ id, teacher_id, ...rest }) => ({
        ...rest,
        school_id: user.schoolId,
      }));

      const studentIds = cleanedGrades.map(g => g.student_id);

      // Try upsert with onConflict; if unique constraint doesn't exist on remote DB, fallback to delete + insert
      const { error } = await supabase
        .from('grades')
        .upsert(cleanedGrades, { onConflict: 'student_id,exam_template_id' });

      if (error) {
        // Fallback: Delete existing grades for these students on this exam then insert
        const { error: delError } = await supabase
          .from('grades')
          .delete()
          .eq('exam_template_id', templateId)
          .in('student_id', studentIds);

        if (delError) throw delError;

        const { error: insError } = await supabase
          .from('grades')
          .insert(cleanedGrades);

        if (insError) throw insError;
      }

      // Log action to audit logs (safe against audit RPC failures)
      try {
        await (supabase as any).rpc('log_action', {
          p_action: 'UPSERT_GRADES',
          p_entity_type: 'grades',
          p_details: `رصد درجات لعدد ${grades.length} طلاب في اختبار ${templateId}`
        });
      } catch {
        // Ignore audit log error if RPC not available
      }
    },
    onMutate: async (newGrades) => {
      if (newGrades.length === 0) return;
      const templateId = newGrades[0].exam_template_id;
      const classId = newGrades[0].class_id;
      const queryKey = ['student-grades', templateId, classId];

      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return old.map((s: any) => {
          const grade = newGrades.find(g => g.student_id === s.studentId);
          return grade ? { ...s, score: String(grade.score) } : s;
        });
      });

      return { previousData, queryKey };
    },
    onError: (err, newGrades, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: ['exam-templates'] });
      queryClient.invalidateQueries({ queryKey: ['student-grades'] });
      queryClient.invalidateQueries({ queryKey: ['student-grades-full'] });
      queryClient.invalidateQueries({ queryKey: ['child-full-details'] });
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      queryClient.invalidateQueries({ queryKey: ['parent-children'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });
}

export function useGrades(studentId: string | null) {
  const queryKey = useMemo(() => ['grades', studentId], [studentId]);
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from('grades')
        .select('id, student_id, score, max_score, subject, term, exam_template_id, created_at')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!studentId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

export function useStudentDetailedGrades(studentId: string | null) {
  const queryKey = useMemo(() => ['grades', 'detailed', studentId], [studentId]);
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from('grades')
        .select(`
          id, student_id, score, max_score, subject, term, exam_template_id, school_id, created_at,
          exam_templates (
            subject,
            max_score,
            title
          )
        `)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!studentId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}
