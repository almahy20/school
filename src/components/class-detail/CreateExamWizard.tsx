import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useCreateElectronicExam,
  useUpdateElectronicExam,
  useSaveExamQuestions,
  useExamQuestions,
  type ElectronicExam,
  type QuestionType,
} from '@/hooks/queries/useElectronicExams';

import {
  examSchema,
  emptyQuestion,
  makeKey,
  type ExamFormData,
  type LocalQuestion,
  type WizardStep,
} from './exam-wizard/types';
import ExamSettingsStep from './exam-wizard/ExamSettingsStep';
import QuestionBuilderStep from './exam-wizard/QuestionBuilderStep';
import ExamReviewStep from './exam-wizard/ExamReviewStep';

interface CreateExamWizardProps {
  classId: string;
  className: string;
  onBack: () => void;
  editExam?: ElectronicExam | null;
}

export default function CreateExamWizard({ classId, className, onBack, editExam }: CreateExamWizardProps) {
  // className is received in props to satisfy the interface contract
  void className;

  const [step, setStep] = useState<WizardStep>('info');
  const [examId, setExamId] = useState<string | null>(editExam?.id || null);
  const [questions, setQuestions] = useState<LocalQuestion[]>([emptyQuestion()]);
  const [isPublishing, setIsPublishing] = useState(false);

  const createExam    = useCreateElectronicExam();
  const updateExam    = useUpdateElectronicExam();
  const saveQuestions = useSaveExamQuestions();

  // Load existing questions when editing
  const { data: existingQuestions = [] } = useExamQuestions(editExam?.id || null);

  useEffect(() => {
    if (existingQuestions.length > 0) {
      setQuestions(existingQuestions.map(q => ({
        id:            q.id,
        _key:          makeKey(),
        question_type: q.question_type,
        question_text: q.question_text,
        options:       (q.options as [string, string, string, string]) || ['', '', '', ''],
        correct_answer: q.correct_answer,
      })));
    }
  }, [existingQuestions]);

  const form = useForm<ExamFormData>({
    resolver: zodResolver(examSchema),
    defaultValues: {
      title:            editExam?.title || '',
      subject:          editExam?.subject || '',
      duration_minutes: editExam?.duration_minutes || 30,
      available_until:  editExam?.available_until ? new Date(editExam.available_until).toISOString().slice(0, 16) : '',
      language:         (editExam?.language as 'ar' | 'en') || 'ar',
      instructions:     editExam?.instructions || '',
    },
  });

  const currentLanguage = form.watch('language');

  // ── Step 1: Save exam info ─────────────────────────────────────────────────
  const handleSaveInfo = form.handleSubmit(async (data) => {
    try {
      const payload = {
        ...data,
        available_until: data.available_until ? new Date(data.available_until).toISOString() : null,
      };

      if (examId) {
        await updateExam.mutateAsync({ id: examId, class_id: classId, ...payload });
      } else {
        const exam = await createExam.mutateAsync({ class_id: classId, ...payload });
        setExamId(exam.id);
      }
      setStep('questions');
    } catch (err: unknown) {
      // react-hook-form handleSubmit already surfaces errors via form state
      void err;
    }
  });

  // ── Step 2: Save questions ─────────────────────────────────────────────────
  const handleSaveQuestions = async (andPublish = false) => {
    if (!examId) return;

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) {
        toast.error(`السؤال ${i + 1}: نص السؤال مطلوب`);
        return;
      }
      if (q.question_type === 'multiple_choice') {
        if (q.options.some(o => !o.trim())) {
          toast.error(`السؤال ${i + 1}: جميع الخيارات مطلوبة`);
          return;
        }
        if (!q.correct_answer) {
          toast.error(`السؤال ${i + 1}: يجب تحديد الإجابة الصحيحة`);
          return;
        }
      }
      if (q.question_type === 'fill_blank' && !q.correct_answer.trim()) {
        toast.error(`السؤال ${i + 1}: الإجابة الصحيحة مطلوبة`);
        return;
      }
    }

    try {
      await saveQuestions.mutateAsync({
        examId,
        questions: questions.map((q, i) => ({
          id:             q.id,
          question_type:  q.question_type,
          question_text:  q.question_text,
          options:        q.question_type === 'multiple_choice' ? q.options : null,
          correct_answer: q.correct_answer,
          order_index:    i,
        })),
      });

      if (andPublish) {
        setIsPublishing(true);
        await updateExam.mutateAsync({ id: examId, class_id: classId, status: 'published' });
        setIsPublishing(false);
        toast.success('تم حفظ التعديلات وإعادة تصحيح درجات الطلاب تلقائياً 🎉');
        onBack();
      } else {
        toast.success('تم حفظ الأسئلة وإعادة تصحيح نتائج الاختبار 🎯');
        setStep('preview');
      }
    } catch (_) {
      setIsPublishing(false);
    }
  };

  const handlePublishFromPreview = async () => {
    if (!examId) return;
    setIsPublishing(true);
    try {
      await updateExam.mutateAsync({ id: examId, class_id: classId, status: 'published' });
      toast.success('تم نشر الاختبار بنجاح');
      onBack();
    } catch (err: unknown) {
      // toast error already shown by mutation onError
      void err;
    }
    setIsPublishing(false);
  };

  // ── Question helpers ───────────────────────────────────────────────────────
  const updateQuestion = (idx: number, patch: Partial<LocalQuestion>) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...patch } : q));
  };

  const addQuestion = () => {
    if (questions.length >= 50) return;
    setQuestions(prev => [...prev, emptyQuestion()]);
  };

  const removeQuestion = (idx: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setQuestions(prev => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const moveDown = (idx: number) => {
    if (idx === questions.length - 1) return;
    setQuestions(prev => {
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const changeType = (idx: number, type: QuestionType) => {
    updateQuestion(idx, {
      question_type:  type,
      correct_answer: type === 'true_false' ? 'true' : '',
      options:        ['', '', '', ''],
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-black text-slate-400 hover:text-slate-900 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          الاختبارات
        </button>
        <span className="text-slate-200">/</span>
        <span className="text-sm font-black text-slate-900">
          {editExam ? 'تعديل الاختبار' : 'اختبار جديد'}
        </span>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {(['info', 'questions', 'preview'] as WizardStep[]).map((s, i) => {
          const labels = ['بيانات الاختبار', 'الأسئلة', 'معاينة ونشر'];
          const isActive = step === s;
          const isDone = (
            (s === 'info' && (step === 'questions' || step === 'preview')) ||
            (s === 'questions' && step === 'preview')
          );
          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px bg-slate-200" />}
              <div className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black transition-colors',
                isActive ? 'bg-violet-600 text-white' : isDone ? 'bg-violet-50 text-violet-600' : 'bg-slate-50 text-slate-400'
              )}>
                <span className={cn('w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black',
                  isActive ? 'bg-white/20' : isDone ? 'bg-violet-100' : 'bg-slate-100'
                )}>
                  {isDone ? '✓' : i + 1}
                </span>
                {labels[i]}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Step 1: Info ── */}
      {step === 'info' && (
        <ExamSettingsStep
          form={form}
          onSubmit={handleSaveInfo}
          isSubmitting={createExam.isPending || updateExam.isPending}
        />
      )}

      {/* ── Step 2: Questions ── */}
      {step === 'questions' && (
        <QuestionBuilderStep
          questions={questions}
          examLanguage={currentLanguage}
          isSaving={saveQuestions.isPending}
          isPublishing={isPublishing}
          onUpdateQuestion={updateQuestion}
          onChangeType={changeType}
          onMoveUp={moveUp}
          onMoveDown={moveDown}
          onRemoveQuestion={removeQuestion}
          onAddQuestion={addQuestion}
          onBackToInfo={() => setStep('info')}
          onSaveQuestions={handleSaveQuestions}
        />
      )}

      {/* ── Step 3: Preview ── */}
      {step === 'preview' && (
        <ExamReviewStep
          questions={questions}
          examLanguage={currentLanguage}
          isPublishing={isPublishing}
          onBackToQuestions={() => setStep('questions')}
          onPublish={handlePublishFromPreview}
        />
      )}
    </div>
  );
}
