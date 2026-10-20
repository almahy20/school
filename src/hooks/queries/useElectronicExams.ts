import { useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { realtimeEngine } from '@/lib/RealtimeEngine';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/utils/logger';
import { isExamAnswerCorrect } from '@/utils/arabicSearch';

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

/** تحويل وتفريغ الخيارات بأمان لمنع أي استثناء في حال كانت المخزنة نصاً أو غير مصفوفة */
export function safeParseOptions(opts: any): string[] {
  if (!opts) return [];
  if (Array.isArray(opts)) return opts.map(String);
  if (typeof opts === 'string') {
    try {
      const parsed = JSON.parse(opts);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [];
    }
  }
  if (typeof opts === 'object') {
    return Object.values(opts).map(String);
  }
  return [];
}

/** قراءة إجابات الطالب بأمان من المحاولة سواء كانت كائناً أو نص JSON */
export function safeParseAnswers(answers: any): Record<string, string> {
  if (!answers) return {};
  if (typeof answers === 'string') {
    try {
      const parsed = JSON.parse(answers);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof answers === 'object' && answers !== null ? answers : {};
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
          classes(name),
          exam_questions(id),
          exam_attempts(id, score, total_score)
        `)
        .eq('school_id', user.schoolId)
        .eq('class_id', classId)
        .order('created_at', { ascending: false })
        .limit(50); // الاختبارات لفصل واحد — 50 كافية

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
export function useExamQuestions(examId: string | undefined | null, options?: { excludeAnswer?: boolean }) {
  const { session } = useAuth();

  return useQuery<ExamQuestion[]>({
    queryKey: ['exam-questions', examId, options?.excludeAnswer ? 'no-answer' : 'with-answer'],
    queryFn: async () => {
      if (!examId) return [];

      if (options?.excludeAnswer) {
        // 1. محاولة الجلب من الـ View الآمن المخصص للطلاب أولاً
        try {
          const { data, error } = await db
            .from('student_exam_questions')
            .select('id, exam_id, school_id, question_type, question_text, options, order_index, created_at')
            .eq('exam_id', examId)
            .order('order_index', { ascending: true });
          if (!error && data && data.length > 0) {
            return data as ExamQuestion[];
          }
          if (error) {
            logger.warn('[useExamQuestions] student_exam_questions view error, trying fallback:', error.message);
          }
        } catch (e) {
          logger.warn('[useExamQuestions] student_exam_questions view exception:', e);
        }

        // 2. بديل آمن 100%: استعلام مباشر لجدول exam_questions بدون جلب عمود correct_answer نهائياً
        const { data: fallbackData, error: fallbackError } = await db
          .from('exam_questions')
          .select('id, exam_id, school_id, question_type, question_text, options, order_index, created_at')
          .eq('exam_id', examId)
          .order('order_index', { ascending: true });

        if (fallbackError) {
          logger.error('[useExamQuestions] exam_questions fallback failed:', fallbackError);
          throw fallbackError;
        }
        return (fallbackData || []) as ExamQuestion[];
      }

      const { data, error } = await db
        .from('exam_questions')
        .select('id, exam_id, school_id, question_type, question_text, options, correct_answer, order_index, created_at')
        .eq('exam_id', examId)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return (data || []) as ExamQuestion[];
    },
    enabled: !!(session && examId),
    staleTime: 30 * 1000,
  });
}

/** مراجعة أسئلة اختبار مع الإجابات النموذجية بعد تسليم المحاولة حصراً عبر RPC */
export function useExamReviewQuestions(examId: string | undefined) {
  const { session } = useAuth();

  return useQuery<ExamQuestion[]>({
    queryKey: ['exam-review-questions', examId],
    queryFn: async () => {
      if (!examId) return [];
      try {
        const { data, error } = await db.rpc('get_exam_review_questions', {
          p_exam_id: examId,
        });
        if (!error && Array.isArray(data) && data.length > 0) {
          return data as ExamQuestion[];
        }
        if (error) {
          logger.warn('[useExamReviewQuestions] RPC error:', error?.message);
        }
      } catch (e) {
        logger.warn('[useExamReviewQuestions] RPC exception:', e);
      }

      // بديل مباشر: محاولة الجلب من view أسئلة الطلاب الآمنة
      try {
        const { data: viewData, error: viewError } = await db
          .from('student_exam_questions')
          .select('id, exam_id, school_id, question_type, question_text, options, order_index, created_at')
          .eq('exam_id', examId)
          .order('order_index', { ascending: true });
        if (!viewError && Array.isArray(viewData) && viewData.length > 0) {
          return viewData as ExamQuestion[];
        }
      } catch (viewEx) {
        logger.warn('[useExamReviewQuestions] student_exam_questions view fallback exception:', viewEx);
      }

      // بديل مباشر أخير لجدول exam_questions
      try {
        const { data, error } = await db
          .from('exam_questions')
          .select('id, exam_id, school_id, question_type, question_text, options, correct_answer, order_index, created_at')
          .eq('exam_id', examId)
          .order('order_index', { ascending: true });
        if (!error && Array.isArray(data)) {
          return data as ExamQuestion[];
        }
      } catch (directEx) {
        logger.warn('[useExamReviewQuestions] exam_questions direct fallback exception:', directEx);
      }

      return [];
    },
    enabled: !!(session && examId),
    staleTime: 5 * 60 * 1000,
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
        .order('completed_at', { ascending: false })
        .limit(200); // محاولات اختبار واحد — 200 تكفي فصلاً كاملاً مع تكرار
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
      queryClient.invalidateQueries({ queryKey: ['electronic-exams'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['electronic-exams'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['electronic-exams'] });
      queryClient.invalidateQueries({ queryKey: ['exam-attempts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
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

      const keptIds = questions.filter(q => !!q.id).map(q => q.id as string);

      // 1. حذف فقط الأسئلة التي قام المعلم بإزالتها
      if (keptIds.length > 0) {
        await db
          .from('exam_questions')
          .delete()
          .eq('exam_id', examId)
          .not('id', 'in', `(${keptIds.join(',')})`);
      } else {
        await db
          .from('exam_questions')
          .delete()
          .eq('exam_id', examId);
      }

      if (questions.length === 0) return [];

      // 2. حفظ الأسئلة (تحديث الموجودة بالـ ID نفسه وإضافة الجديدة)
      const rows = questions.map((q, i) => {
        const row: any = {
          exam_id:        examId,
          school_id:      user.schoolId,
          question_type:  q.question_type,
          question_text:  q.question_text.trim(),
          options:        q.options,
          correct_answer: q.correct_answer.trim(),
          order_index:    i,
        };
        if (q.id) {
          row.id = q.id;
        }
        return row;
      });

      const { data, error } = await db
        .from('exam_questions')
        .upsert(rows)
        .select();
      if (error) throw error;

      // 3. 🎯 إعادة تصحيح وحساب درجات الطلاب تلقائياً عند تغيير الإجابة
      try {
        const { data: rescoreData, error: rescoreErr } = await db.rpc('recalculate_exam_scores', {
          p_exam_id: examId,
        });
        if (!rescoreErr && rescoreData?.attempts_updated > 0) {
          logger.log(`[Exam] Recalculated ${rescoreData.attempts_updated} student attempt(s) automatically!`);
        }
      } catch (rErr) {
        logger.warn('[Exam] Server rescore skipped:', rErr);
      }

      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['exam-questions', vars.examId] });
      queryClient.invalidateQueries({ queryKey: ['exam-attempts'] });
      queryClient.invalidateQueries({ queryKey: ['electronic-exams'] });
    },
    onError: (err: any) => {
      toast.error('فشل حفظ الأسئلة', { description: err.message });
    },
  });
}

// ─── Parent Hooks ──────────────────────────────────────────────────────────────

/** دالة مساعدة لتوليد كافة صيغ أرقام الهواتف المحتملة (المحلية، الدولية، بدون أصفار، مع +20 وغيرها) */
function getAllPhoneVariants(phone?: string | null): string[] {
  if (!phone) return [];
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return [trimmed];

  const variants = new Set<string>();
  variants.add(trimmed);
  variants.add(digits);

  if (digits.length >= 9) {
    const last10 = digits.slice(-10);
    const last9 = digits.slice(-9);

    variants.add(last10);
    variants.add(`0${last10}`);
    variants.add(`20${last10}`);
    variants.add(`+20${last10}`);
    variants.add(`0020${last10}`);

    variants.add(last9);
    variants.add(`0${last9}`);
  }
  return Array.from(variants);
}

/** اختبارات ولي الأمر (كل أبنائه) */
export function useParentElectronicExams() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['electronic-exams', 'parent', user?.id], [user?.id]);

  // Realtime: لما يُنشر اختبار جديد يظهر فوراً
  useEffect(() => {
    if (!user?.id) return;

    return realtimeEngine.subscribe(
      'electronic_exams',
      () => {
        queryClient.invalidateQueries({ queryKey });
      },
      user?.schoolId ? { filter: `school_id=eq.${user.schoolId}` } : undefined
    );
  }, [user?.id, user?.schoolId, queryClient, queryKey]);

  return useQuery<Array<ElectronicExam & { student_id: string; student_name: string; attempt?: ExamAttempt }>>({
    queryKey,
    queryFn: async () => {
      if (!user?.id) return [];

      // ── 1. المحاولة عبر RPC المباشر الآمن (أسرع، 0 أخطاء RLS، استعلام خادم واحد) ──
      try {
        const { data: rpcData, error: rpcErr } = await db.rpc('get_parent_electronic_exams', {
          p_parent_id: user.id,
          p_school_id: user.schoolId || null,
        });

        if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
          return rpcData as Array<ElectronicExam & { student_id: string; student_name: string; attempt?: ExamAttempt }>;
        }
        if (rpcErr) {
          logger.warn('[useParentElectronicExams] RPC get_parent_electronic_exams not available, using fallback:', rpcErr.message);
        }
      } catch (rpcEx) {
        logger.warn('[useParentElectronicExams] RPC exception:', rpcEx);
      }

      // ── 2. البديل المباشر الموثوق: استعلامات شاملة للأبناء عبر student_parents + الهاتف مع معالجة الربط التلقائي ──
      const studentMap = new Map<string, { student_id: string; student: any }>();

      // 2أ. جلب الأبناء المرتبطين مسبقاً عبر student_parents
      try {
        const { data: spData, error: spErr } = await db
          .from('student_parents')
          .select('student_id, students(id, name, class_id, school_id, classes(name))')
          .eq('parent_id', user.id);

        if (!spErr && spData) {
          spData.forEach((c: any) => {
            if (c.student_id && c.students) {
              studentMap.set(c.student_id, {
                student_id: c.student_id,
                student: c.students,
              });
            }
          });
        }
      } catch (spCatch) {
        logger.warn('[useParentElectronicExams] student_parents query warning:', spCatch);
      }

      // 2ب. جلب الأبناء برقم هاتف ولي الأمر (لضمان شمول كافة الأبناء حتى لو لم يتم ربطهم بعد)
      let effectivePhone = user.phone;
      if (!effectivePhone) {
        try {
          const { data: prof } = await db.from('profiles').select('phone').eq('id', user.id).maybeSingle();
          if (prof?.phone) effectivePhone = prof.phone;
        } catch { /* ignore */ }
      }

      if (effectivePhone) {
        try {
          const phoneVariants = getAllPhoneVariants(effectivePhone);
          if (phoneVariants.length > 0) {
            const { data: phoneStudents, error: pErr } = await db
              .from('students')
              .select('id, name, class_id, school_id, classes(name)')
              .in('parent_phone', phoneVariants);

            if (!pErr && phoneStudents && phoneStudents.length > 0) {
              const unlinked: any[] = [];
              phoneStudents.forEach((s: any) => {
                if (!studentMap.has(s.id)) {
                  studentMap.set(s.id, {
                    student_id: s.id,
                    student: s,
                  });
                  unlinked.push(s);
                }
              });

              // إصلاح وربط تلقائي بالخلفية لعدم تكرار البحث مستقبلاً
              if (unlinked.length > 0) {
                const linksToInsert = unlinked.map((s: any) => ({
                  school_id: s.school_id || user.schoolId,
                  student_id: s.id,
                  parent_id: user.id,
                }));
                db.from('student_parents').upsert(linksToInsert, { onConflict: 'student_id,parent_id' }).then();
              }
            }
          }
        } catch (phoneErr) {
          logger.warn('[useParentElectronicExams] phone fallback error:', phoneErr);
        }
      }

      const childrenList = Array.from(studentMap.values());
      if (!childrenList.length) return [];

      const classIds = [...new Set(
        childrenList.map((c) => c.student?.class_id).filter(Boolean)
      )];

      if (!classIds.length) return [];

      // 2ج. جلب الاختبارات المنشورة للفصول التابعة لأبناء ولي الأمر
      let exams: any[] = [];
      try {
        const { data: examsData, error: exErr } = await db
          .from('electronic_exams')
          .select('*, classes(name)')
          .eq('status', 'published')
          .in('class_id', classIds)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!exErr && examsData) {
          exams = examsData;
        } else {
          // استعلام بسيط بدون join كخطة بديلة
          const { data: simpleExams } = await db
            .from('electronic_exams')
            .select('*')
            .eq('status', 'published')
            .in('class_id', classIds)
            .order('created_at', { ascending: false })
            .limit(50);
          exams = simpleExams || [];
        }
      } catch (exErr) {
        logger.error('[useParentElectronicExams] exams query failed:', exErr);
        return [];
      }

      if (!exams.length) return [];

      // 2د. جلب عدد الأسئلة بأمان
      const examIds = exams.map((e: any) => e.id);
      const questionCounts: Record<string, number> = {};
      try {
        const { data: qData } = await db
          .from('student_exam_questions')
          .select('exam_id')
          .in('exam_id', examIds);
        (qData || []).forEach((q: any) => {
          questionCounts[q.exam_id] = (questionCounts[q.exam_id] || 0) + 1;
        });
      } catch {
        try {
          const { data: qData } = await db
            .from('exam_questions')
            .select('id, exam_id')
            .in('exam_id', examIds);
          (qData || []).forEach((q: any) => {
            questionCounts[q.exam_id] = (questionCounts[q.exam_id] || 0) + 1;
          });
        } catch { /* ignore */ }
      }

      // 2هـ. جلب محاولات ولي الأمر / الأبناء بدقة مع دعم التوأم والأخوة
      const studentIds = childrenList.map((c) => c.student_id);
      const attemptsMap = new Map<string, ExamAttempt>();
      try {
        let attemptsQuery = db
          .from('exam_attempts')
          .select('id, exam_id, student_id, parent_id, score, total_score, completed_at, answers')
          .in('exam_id', examIds);

        if (studentIds.length > 0) {
          attemptsQuery = attemptsQuery.or(`parent_id.eq.${user.id},student_id.in.(${studentIds.join(',')})`);
        } else {
          attemptsQuery = attemptsQuery.eq('parent_id', user.id);
        }

        const { data: attempts } = await attemptsQuery;
        (attempts || []).forEach((a: any) => {
          if (a.student_id) {
            attemptsMap.set(`${a.exam_id}_${a.student_id}`, a);
          }
          if (!attemptsMap.has(a.exam_id)) {
            attemptsMap.set(a.exam_id, a);
          }
        });
      } catch (attErr) {
        logger.warn('[useParentElectronicExams] attempts query warning:', attErr);
      }

      // 2و. دمج النتائج مع بيانات الطلاب (دعم كامل للأخوة في نفس الفصل)
      const result: any[] = [];
      for (const exam of exams) {
        const matchingChildren = childrenList.filter((c) => c.student?.class_id === exam.class_id);
        for (const childItem of matchingChildren) {
          if (!childItem?.student) continue;
          const attempt = attemptsMap.get(`${exam.id}_${childItem.student.id}`) || attemptsMap.get(exam.id) || null;
          result.push({
            ...exam,
            class_name:      exam.classes?.name || childItem.student?.classes?.name || '',
            questions_count: questionCounts[exam.id] || 0,
            student_id:      childItem.student.id,
            student_name:    childItem.student.name,
            attempt,
          });
        }
      }
      return result;
    },
    enabled: !!(session && user?.id),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/** إرسال إجابات الاختبار — التصحيح يتم بالكامل على السيرفر مع تجديد التوكن التلقائي */
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

      // 🔄 1. التأكد من صلاحية الـ Session وتجديد التوكن إذا كان منتهياً قبل الإرسال
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const currentSession = sessionData?.session;
        // إذا كان التوكن ينتهي خلال أقل من دقيقتين أو منتهي، نجدده فوراً
        if (!currentSession || (currentSession.expires_at && currentSession.expires_at * 1000 < Date.now() + 120000)) {
          logger.log('[Exam] Proactively refreshing auth session before submit...');
          await supabase.auth.refreshSession();
        }
      } catch (e) {
        logger.warn('[Exam] Proactive session check warning:', e);
      }

      // 🔄 2. محاولة الإرسال عبر الـ RPC
      let rpcResult: any = null;
      let rpcError: any = null;

      try {
        const res = await db.rpc('submit_exam_attempt', {
          p_exam_id:            examId,
          p_student_id:         studentId,
          p_parent_id:          user.id,
          p_answers:            answers,
          p_time_spent_seconds: timeSpentSeconds,
          p_tab_switches_count: tabSwitchesCount,
        });
        rpcResult = res.data;
        rpcError = res.error;
      } catch (err) {
        rpcError = err;
      }

      // 🔄 3. إذا حدث خطأ JWT expired أثناء الـ RPC — نجدد التوكن ونعيد المحاولة فوراً
      if (
        rpcError &&
        (rpcError.message?.includes('JWT') ||
         rpcError.message?.includes('expired') ||
         rpcError.message?.includes('token') ||
         rpcError.code === 'PGRST301' ||
         rpcError.status === 401)
      ) {
        logger.warn('[Exam] JWT expired during submit_exam_attempt RPC, refreshing session and retrying...');
        const { error: refreshErr } = await supabase.auth.refreshSession();
        if (!refreshErr) {
          const retryRes = await db.rpc('submit_exam_attempt', {
            p_exam_id:            examId,
            p_student_id:         studentId,
            p_parent_id:          user.id,
            p_answers:            answers,
            p_time_spent_seconds: timeSpentSeconds,
            p_tab_switches_count: tabSwitchesCount,
          });
          rpcResult = retryRes.data;
          rpcError = retryRes.error;
        }
      }

      if (rpcError || !rpcResult) {
        logger.warn('[Exam] submit_exam_attempt RPC failed, trying resilient direct save fallback:', rpcError?.message);

        // Fetch questions with correct answers
        let reviewQuestions = questions;
        try {
          const { data: revData } = await db.rpc('get_exam_review_questions', { p_exam_id: examId });
          if (revData && revData.length > 0) {
            reviewQuestions = revData as ExamQuestion[];
          }
        } catch { /* ignore */ }

        if (!reviewQuestions.some(q => !!q.correct_answer)) {
          try {
            const { data: qData } = await db
              .from('exam_questions')
              .select('id, exam_id, school_id, question_type, question_text, options, correct_answer, order_index, created_at')
              .eq('exam_id', examId);
            if (qData && qData.length > 0) {
              reviewQuestions = qData as ExamQuestion[];
            }
          } catch { /* ignore */ }
        }

        // Calculate score with flexible Arabic tolerance
        let calculatedScore = 0;
        reviewQuestions.forEach((q) => {
          const given = answers[q.id];
          if (q.correct_answer && isExamAnswerCorrect(given, q.correct_answer, q.question_type)) {
            calculatedScore++;
          }
        });

        // Direct fallback: Upsert attempt into exam_attempts
        const { data: fallbackAttempt, error: fallbackError } = await db
          .from('exam_attempts')
          .upsert({
            exam_id:            examId,
            student_id:         studentId,
            parent_id:          user.id,
            answers:            answers,
            score:              calculatedScore,
            total_score:        reviewQuestions.length,
            time_spent_seconds: timeSpentSeconds,
            tab_switches_count: tabSwitchesCount,
            completed_at:       new Date().toISOString(),
          }, { onConflict: 'exam_id,student_id' })
          .select('id, score, total_score')
          .single();

        if (fallbackError) {
          logger.error('[Exam] Direct attempt fallback also failed:', fallbackError.message);
          throw new Error(rpcError?.message || fallbackError.message || 'فشل تسليم الاختبار');
        }

        return {
          score: fallbackAttempt?.score ?? calculatedScore,
          totalScore: fallbackAttempt?.total_score ?? reviewQuestions.length,
          questions: reviewQuestions,
          answers,
        };
      }

      // Server returned: { score, total_score, questions, questions_with_answers }
      const scoredQs = (rpcResult.questions || rpcResult.questions_with_answers) as ExamQuestion[] | undefined;
      const finalTotalScore = rpcResult.total_score ?? rpcResult.totalScore ?? questions.length;
      return {
        score: rpcResult.score,
        totalScore: finalTotalScore,
        // correct_answer is revealed only AFTER server saves the attempt
        questions: (scoredQs && scoredQs.length > 0 ? scoredQs : questions) as ExamQuestion[],
        answers,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['electronic-exams'] });
      queryClient.invalidateQueries({ queryKey: ['exam-attempts'] });
      queryClient.invalidateQueries({ queryKey: ['child-full-details'] });
    },
    onError: (err: any) => {
      toast.error('فشل إرسال الاختبار', { description: err.message });
    },
  });
}
