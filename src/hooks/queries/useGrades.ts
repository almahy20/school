import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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



export function useExamTemplates(classId: string | null, subject: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['exam-templates', user?.schoolId, classId, subject],
    queryFn: async () => {
      if (!user?.schoolId || !classId) return [];
      let query = supabase
        .from('exam_templates')
        .select('*')
        .eq('school_id', user.schoolId)
        .eq('class_id', classId);
      
      if (subject) {
        query = query.eq('subject', subject);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return (data as ExamTemplate[]) || [];
    },
    enabled: !!(user?.schoolId && classId),
  });
}

export function useStudentGrades(templateId: string | null, classId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['student-grades', templateId, classId],
    queryFn: async () => {
      if (!user?.schoolId || !classId || !templateId) return [];
      
      // Fetch students in class
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
      const { error } = await supabase.from('grades').upsert(grades);
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
  return useQuery({
    queryKey: ['grades', studentId],
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

