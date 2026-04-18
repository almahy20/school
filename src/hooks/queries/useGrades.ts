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
}

export interface StudentGrade {
  studentId: string;
  studentName: string;
  score: string;
  gradeId?: string;
}

export function useExamTemplates(classId: string | null, subject: string | null, page = 1, pageSize = 10) {
  const { user } = useAuth();
  const queryKey = ['exam-templates', user?.schoolId, classId, subject, page, pageSize];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.schoolId || !classId) return { data: [], count: 0 };
      
      let q = supabase
        .from('exam_templates')
        .select('*', { count: 'exact' })
        .eq('school_id', user.schoolId)
        .eq('class_id', classId);
      
      if (subject) {
        q = q.eq('subject', subject);
      }
      
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await q
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { data: (data as ExamTemplate[]) || [], count: count || 0 };
    },
    enabled: !!(user?.schoolId && classId),
    placeholderData: (previousData: any) => previousData,
    retry: 1,
    retryDelay: 1000,
  });
}

export function useStudentGrades(templateId: string | null, classId: string | null) {
  const { user } = useAuth();
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
            exam_template_id
          )
        `)
        .eq('school_id', user.schoolId)
        .eq('class_id', classId)
        .order('name');
      
      if (error) throw error;
      if (!studentsWithGrades?.length) return [];

      // Transform data to match expected format
      return studentsWithGrades.map(s => {
        const grade = Array.isArray(s.grades) 
          ? s.grades.find((g: any) => g.exam_template_id === templateId)
          : s.grades;
        
        return {
          studentId: s.id,
          studentName: s.name,
          score: grade ? String(grade.score) : '',
          gradeId: grade?.id,
        };
      }) as StudentGrade[];
    },
    enabled: !!(user?.schoolId && classId && templateId),
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 2,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: (previousData: any) => previousData,
    retry: 1,
    retryDelay: 1000,
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
      queryClient.invalidateQueries({ queryKey: ['grades'], exact: false });
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
      const studentIds = grades.map(g => g.student_id);
      
      // 1. Delete existing
      await supabase
        .from('grades')
        .delete()
        .eq('exam_template_id', templateId)
        .in('student_id', studentIds);
        
      // 2. Clean id and insert fresh with school context
      const cleanedGrades = grades.map(({ id, ...rest }) => ({
        ...rest,
        school_id: user.schoolId,
        teacher_id: user.id
      }));

      const { error } = await supabase.from('grades').insert(cleanedGrades);
      if (error) throw error;

    },
    onSuccess: (_, variables) => {
      if (variables.length > 0) {
        queryClient.invalidateQueries({ 
          queryKey: ['student-grades', variables[0].exam_template_id] 
        });
      }
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
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!studentId,
  });
}

