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
    staleTime: 30 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useStudentGrades(templateId: string | null, classId: string | null) {
  const { user } = useAuth();
  const queryKey = ['student-grades', templateId, classId];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.schoolId || !classId || !templateId) return [];
      
      // Fetch students in class (usually small enough for a class, but we could paginate if needed)
      const { data: students, error: sError } = await supabase
        .from('students')
        .select('id, name')
        .eq('school_id', user.schoolId)
        .eq('class_id', classId)
        .order('name');
      if (sError) throw sError;
      if (!students?.length) return [];

      // Fetch grades for template
      const { data: grades, error: gError } = await supabase.from('grades').select('*')
        .eq('school_id', user.schoolId)
        .in('student_id', students.map(s => s.id))
        .eq('exam_template_id', templateId);
      if (gError) throw gError;

      return students.map(s => {
        const existing = grades?.find(g => g.student_id === s.id);
        return {
          studentId: s.id,
          studentName: s.name,
          score: existing ? String(existing.score) : '',
          gradeId: existing?.id,
        };
      }) as StudentGrade[];
    },
    enabled: !!(user?.schoolId && classId && templateId),
    staleTime: 30 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: keepPreviousData,
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
      queryClient.invalidateQueries({ queryKey: ['grades'] });
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
        
      // 2. Clean id and insert fresh
      const cleanedGrades = grades.map(({ id, ...rest }) => rest);
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

