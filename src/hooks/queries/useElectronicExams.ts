import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const db = supabase as any;

// ─── Types ────────────────────────────────────────────────────────────────────

export type QuestionType = 'true_false' | 'multiple_choice' | 'fill_blank';
export type ExamStatus = 'draft' | 'published' | 'archived';

export interface ExamQuestion {
  id: string;
  exam_id: string;
  school_id: string;
  question_type: QuestionType;
  question_text: string;
  options: string[] | null; // for multiple_choice: ['أ...', 'ب...', 'ج...', 'د...']
  correct_answer: string;
  order_index: number;
  created_at: string;
}

export interface ElectronicExam {
  id: string;
  school_id: string;
  class_id: string;
  teacher_id: string;
  title: string;
  subject: string;
  duration_minutes: number;
  instructions: string | null;
  status: ExamStatus;
  available_from?: string | null;
  available_until?: string | null;
  language?: 'ar' | 'en';
  created_at: string;
  updated_at: string;
  // joined
  class_name?: string;
  questions_count?: number;
  attempts_count?: number;
  avg_score?: number;
}

/** فحص ما إذا كان النص مكتوباً بالإنجليزية لتحديد اتجاه LTR وترقيم A/B/C/D */
export function isEnglishText(text?: string | null): boolean {
  if (!text) return false;
  const cleaned = text.replace(/[^a-zA-Z\u0600-\u06FF]/g, '').trim();
  if (!cleaned) return false;
  return /^[a-zA-Z]/.test(cleaned);
}

export interface ExamAttempt {
  id: string;
  exam_id: string;
  student_id: string;
  parent_id: string;
  answers: Record<string, string>; // question_id -> answer
  score: number;
  total_score: number;
  time_spent_seconds: number;
  tab_switches_count: number; // anti-cheat: number of tab/window switches during exam
  started_at: string;
  completed_at: string | null;
  // joined
  student_name?: string;
}

// ─── Admin/Teacher Hooks ───────────────────────────────────────────────────────

/** قائمة اختبارات فصل معين — للأدمن/المعلم */
export function useClassElectronicExams(classId: string | null) {
  const { user, session } = useAuth();
  const queryKey = ['electronic-exams', 'class', classId, user?.schoolId];

  return useQuery<ElectronicExam[]>({
    queryKey,
    queryFn: async () => {
      if (!user?.schoolId || !classId) return [];

      const { data, error } = await db
        .from('electronic_exams')
        .select(`
          *,
          classes!electronic_exams_class_id_fkey(name),
          exam_questions(id),
          exam_attempts(id, score, total_score)
        `)
        .eq('school_id', user.schoolId)
        .eq('class_id', classId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((e: any) => ({
        ...e,
        class_name: e.classes?.name || '',
        questions_count: Array.isArray(e.exam_questions) ? e.exam_questions.length : 0,
        attempts_count: Array.isArray(e.exam_attempts) ? e.exam_attempts.length : 0,
        avg_score: (() => {
          const attempts = Array.isArray(e.exam_attempts) ? e.exam_attempts : [];
          if (!attempts.length) return 0;
          const completed = attempts.filter((a: any) => a.total_score > 0);
          if (!completed.length) return 0;
          const sum = completed.reduce((acc: number, a: any) =>
            acc + Math.round((a.score / a.total_score) * 100), 0);
          return Math.round(sum / completed.length);
        })(),
      })) as ElectronicExam[];
    },
    enabled: !!(session && user?.schoolId && classId),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/** أسئلة اختبار واحد */
export function useExamQuestions(examId: string | null) {
  const { user, session } = useAuth();

  return useQuery<ExamQuestion[]>({
    queryKey: ['exam-questions', examId],
    queryFn: async () => {
      if (!examId) return [];
      const { data, error } = await db
        .from('exam_questions')
        // ⚠️ SECURITY: correct_answer intentionally excluded during exam.
        // It is only returned server-side via RPC after the attempt is submitted.
        .select('id, exam_id, school_id, question_type, question_text, options, order_index, created_at')
        .eq('exam_id', examId)
        .order('order_index', { ascending: true });
      if (error) throw error;
      // Belt-and-suspenders: strip any correct_answer the server might return
      return (data || []).map((q: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { correct_answer: _hidden, ...safe } = q;
        return safe as ExamQuestion;
      });
    },
    enabled: !!(session && examId),
    staleTime: 30 * 1000,
  });
}


/** محاولات اختبار واحد — للأدمن */
export function useExamAttempts(examId: string | null) {
  const { user, session } = useAuth();

  return useQuery<ExamAttempt[]>({
    queryKey: ['exam-attempts', examId],
    queryFn: async () => {
      if (!examId) return [];
      const { data, error } = await db
        .from('exam_attempts')
        .select(`
          *,
          student:students!exam_attempts_student_id_fkey(name)
        `)
        .eq('exam_id', examId)
        .order('completed_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((a: any) => ({
        ...a,
        student_name: a.student?.name || 'طالب',
      })) as ExamAttempt[];
    },
    enabled: !!(session && examId),
    staleTime: 15 * 1000,
  });
}

/** إنشاء اختبار جديد */
export function useCreateElectronicExam() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      class_id: string;
      title: string;
      subject: string;
      duration_minutes: number;
      instructions?: string;
      available_from?: string | null;
      available_until?: string | null;
      language?: 'ar' | 'en';
    }) => {
      if (!user?.schoolId || !user?.id) throw new Error('بيانات المستخدم غير مكتملة');
      const { data: exam, error } = await db
        .from('electronic_exams')
        .insert({
          school_id:        user.schoolId,
          teacher_id:       user.id,
          class_id:         data.class_id,
          title:            data.title.trim(),
          subject:          data.subject.trim(),
          duration_minutes: data.duration_minutes,
          instructions:     data.instructions?.trim() || null,
          available_from:   data.available_from || new Date().toISOString(),
          available_until:  data.available_until || null,
          language:         data.language || 'ar',
          status:           'draft',
        })
        .select()
        .single();
      if (error) throw error;
      return exam;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['electronic-exams', 'class', vars.class_id] });
    },
    onError: (err: any) => {
      toast.error('فشل إنشاء الاختبار', { description: err.message });
    },
  });
}

/** تحديث بيانات اختبار */
export function useUpdateElectronicExam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      class_id: string;
      title?: string;
      subject?: string;
      duration_minutes?: number;
      instructions?: string | null;
      available_from?: string | null;
      available_until?: string | null;
      language?: 'ar' | 'en';
      status?: ExamStatus;
    }) => {
      const { id, class_id, ...updates } = data;
      const { data: exam, error } = await db
        .from('electronic_exams')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return exam;
    },
    onSuccess: (exam) => {
      queryClient.invalidateQueries({ queryKey: ['electronic-exams', 'class', exam.class_id] });
      queryClient.invalidateQueries({ queryKey: ['electronic-exams', 'parent'] });
    },
    onError: (err: any) => {
      toast.error('فشل تحديث الاختبار', { description: err.message });
    },
  });
}

/** حذف اختبار */
export function useDeleteElectronicExam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, classId }: { id: string; classId: string }) => {
      const { error } = await db.from('electronic_exams').delete().eq('id', id);
      if (error) throw error;
      return classId;
    },
    onSuccess: (classId) => {
      queryClient.invalidateQueries({ queryKey: ['electronic-exams', 'class', classId] });
    },
    onError: (err: any) => {
      toast.error('فشل حذف الاختبار', { description: err.message });
    },
  });
}

/** حفظ أسئلة الاختبار (bulk upsert) */
export function useSaveExamQuestions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      examId,
      questions,
    }: {
      examId: string;
      questions: Array<{
        id?: string;
        question_type: QuestionType;
        question_text: string;
        options: string[] | null;
        correct_answer: string;
        order_index: number;
      }>;
    }) => {
      if (!user?.schoolId) throw new Error('school_id مفقود');

      // حذف الأسئلة القديمة ثم إدراج الجديدة
      const { error: delErr } = await db
        .from('exam_questions')
        .delete()
        .eq('exam_id', examId);
      if (delErr) throw delErr;

      if (questions.length === 0) return [];

      const rows = questions.map((q, i) => ({
        exam_id:       examId,
        school_id:     user.schoolId,
        question_type: q.question_type,
        question_text: q.question_text.trim(),
        options:       q.options,
        correct_answer: q.correct_answer.trim(),
        order_index:   i,
      }));

      const { data, error } = await db
        .from('exam_questions')
        .insert(rows)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['exam-questions', vars.examId] });
    },
    onError: (err: any) => {
      toast.error('فشل حفظ الأسئلة', { description: err.message });
    },
  });
}

// ─── Parent Hooks ──────────────────────────────────────────────────────────────

/** اختبارات ولي الأمر (كل أبنائه) */
export function useParentElectronicExams() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['electronic-exams', 'parent', user?.id];

  // Realtime: لما يُنشر اختبار جديد يظهر فوراً
  useEffect(() => {
    if (!user?.id || !user?.schoolId) return;
    const channel = db
      .channel(`parent-exams-${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'electronic_exams',
        filter: `school_id=eq.${user.schoolId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, [user?.id, user?.schoolId, queryClient]);

  return useQuery<Array<ElectronicExam & { student_id: string; student_name: string; attempt?: ExamAttempt }>>({
    queryKey,
    queryFn: async () => {
      if (!user?.id || !user?.schoolId) return [];

      // جلب أبناء ولي الأمر مع فصولهم
      const { data: children, error: chErr } = await db
        .from('student_parents')
        .select('student_id, students!student_parents_student_id_fkey(id, name, class_id, classes!students_class_id_fkey(name))')
        .eq('parent_id', user.id);
      if (chErr) throw chErr;
      if (!children?.length) return [];

      const classIds = [...new Set(
        children
          .map((c: any) => c.students?.class_id)
          .filter(Boolean)
      )];

      if (!classIds.length) return [];

      // جلب الاختبارات المنشورة
      const { data: exams, error: exErr } = await db
        .from('electronic_exams')
        .select(`
          *,
          classes!electronic_exams_class_id_fkey(name),
          exam_questions(id)
        `)
        .eq('school_id', user.schoolId)
        .eq('status', 'published')
        .in('class_id', classIds)
        .order('created_at', { ascending: false });
      if (exErr) throw exErr;

      // جلب محاولات ولي الأمر
      const examIds = (exams || []).map((e: any) => e.id);
      const attemptsByExam: Record<string, ExamAttempt> = {};
      if (examIds.length) {
        const { data: attempts } = await db
          .from('exam_attempts')
          .select('*')
          .eq('parent_id', user.id)
          .in('exam_id', examIds);
        (attempts || []).forEach((a: any) => {
          attemptsByExam[a.exam_id] = a;
        });
      }

      // دمج الاختبارات مع بيانات الأبناء
      const result: any[] = [];
      for (const exam of exams || []) {
        // إيجاد الابن المرتبط بهذا الفصل
        const child = children.find((c: any) => c.students?.class_id === exam.class_id);
        if (!child?.students) continue;
        result.push({
          ...exam,
          class_name:      exam.classes?.name || '',
          questions_count: Array.isArray(exam.exam_questions) ? exam.exam_questions.length : 0,
          student_id:      child.students.id,
          student_name:    child.students.name,
          attempt:         attemptsByExam[exam.id] || null,
        });
      }
      return result;
    },
    enabled: !!(session && user?.id),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/** إرسال إجابات الاختبار — التصحيح يتم بالكامل على السيرفر (server-side scoring) */
export function useSubmitExamAttempt() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      examId,
      studentId,
      answers,
      timeSpentSeconds,
      questions,
      tabSwitchesCount = 0,
    }: {
      examId: string;
      studentId: string;
      answers: Record<string, string>;
      timeSpentSeconds: number;
      questions: ExamQuestion[];
      tabSwitchesCount?: number;
    }) => {
      if (!user?.id) throw new Error('المستخدم غير مسجّل الدخول');

      // ⚠️ SECURITY: Call server-side RPC for scoring.
      // The client never has correct_answer (stripped in useExamQuestions),
      // so scoring must happen on the server which has full access.
      const { data: rpcResult, error: rpcError } = await db.rpc('submit_exam_attempt', {
        p_exam_id:            examId,
        p_student_id:         studentId,
        p_parent_id:          user.id,
        p_answers:            answers,
        p_time_spent_seconds: timeSpentSeconds,
        p_tab_switches_count: tabSwitchesCount,
      });

      if (!rpcError && rpcResult) {
        // Server returned: { score, total_score, questions_with_answers }
        const { score, total_score: totalScore, questions: scoredQs } = rpcResult as any;
        return {
          score,
          totalScore,
          // correct_answer is revealed only AFTER server saves the attempt
          questions: (scoredQs || questions) as ExamQuestion[],
          answers,
        };
      }

      // Fallback: RPC not yet deployed → insert manually.
      // Since client has no correct_answer, score will be 0 (safe by design).
      console.warn('[Exam] Server RPC unavailable, fallback insert (score=0):', rpcError?.message);
      const totalScore = questions.length;
      const { data, error } = await db
        .from('exam_attempts')
        .insert({
          exam_id:              examId,
          student_id:           studentId,
          parent_id:            user.id,
          answers,
          score:                0,
          total_score:          totalScore,
          time_spent_seconds:   timeSpentSeconds,
          tab_switches_count:   tabSwitchesCount,
          completed_at:         new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return { score: 0, totalScore, questions, answers };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['electronic-exams', 'parent'] });
      queryClient.invalidateQueries({ queryKey: ['exam-attempts'] });
    },
    onError: (err: any) => {
      toast.error('فشل إرسال الاختبار', { description: err.message });
    },
  });
}
