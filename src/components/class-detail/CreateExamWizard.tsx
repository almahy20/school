import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowRight, Plus, Trash2, ArrowUp, ArrowDown, Eye, Send, Loader2,
  ClipboardList, CheckCircle2, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useCreateElectronicExam,
  useUpdateElectronicExam,
  useSaveExamQuestions,
  useExamQuestions,
  isEnglishText,
  type ElectronicExam,
  type QuestionType,
  type ExamQuestion,
} from '@/hooks/queries/useElectronicExams';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ─── Validation ───────────────────────────────────────────────────────────────

const examSchema = z.object({
  title:            z.string().min(1, 'العنوان مطلوب').max(200, 'الحد الأقصى 200 حرف'),
  subject:          z.string().min(1, 'المادة مطلوبة').max(100, 'الحد الأقصى 100 حرف'),
  duration_minutes: z.coerce.number().min(1, 'المدة لا تقل عن دقيقة').max(180, 'المدة لا تزيد عن 180 دقيقة'),
  available_until:  z.string().optional(),
  language:         z.enum(['ar', 'en']).default('ar'),
  instructions:     z.string().max(1000, 'الحد الأقصى 1000 حرف').optional(),
});
type ExamFormData = z.infer<typeof examSchema>;

// ─── Local question type ──────────────────────────────────────────────────────

interface LocalQuestion {
  _key: string; // local unique id
  question_type: QuestionType;
  question_text: string;
  options: [string, string, string, string]; // MCQ only
  correct_answer: string;
}

function makeKey() {
  return Math.random().toString(36).slice(2);
}

function emptyQuestion(type: QuestionType = 'true_false'): LocalQuestion {
  return {
    _key: makeKey(),
    question_type: type,
    question_text: '',
    options: ['', '', '', ''],
    correct_answer: type === 'true_false' ? 'true' : '',
  };
}

interface CreateExamWizardProps {
  classId: string;
  className: string;
  onBack: () => void;
  editExam?: ElectronicExam | null;
}

type WizardStep = 'info' | 'questions' | 'preview';

export default function CreateExamWizard({ classId, className, onBack, editExam }: CreateExamWizardProps) {
  const [step, setStep] = useState<WizardStep>('info');
  const [examId, setExamId] = useState<string | null>(editExam?.id || null);
  const [questions, setQuestions] = useState<LocalQuestion[]>([emptyQuestion()]);
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const createExam   = useCreateElectronicExam();
  const updateExam   = useUpdateElectronicExam();
  const saveQuestions = useSaveExamQuestions();

  // Load existing questions when editing
  const { data: existingQuestions = [] } = useExamQuestions(editExam?.id || null);

  useEffect(() => {
    if (existingQuestions.length > 0) {
      setQuestions(existingQuestions.map(q => ({
        _key:          makeKey(),
        question_type: q.question_type,
        question_text: q.question_text,
        options:       (q.options as [string, string, string, string]) || ['', '', '', ''],
        correct_answer: q.correct_answer,
      })));
    }
  }, [existingQuestions.length]);

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
    } catch (_) {}
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
        toast.success('تم نشر الاختبار بنجاح');
        onBack();
      } else {
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
    } catch (_) {}
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
    setDeleteIdx(null);
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
        <div className="bg-white border border-slate-100 rounded-[28px] p-6 space-y-5">
          <h3 className="font-black text-slate-900">بيانات الاختبار</h3>
          <form onSubmit={handleSaveInfo} className="space-y-4">
            <FormField
              label="عنوان الاختبار *"
              error={form.formState.errors.title?.message}
            >
              <Input
                {...form.register('title')}
                placeholder="مثال: اختبار الفصل الأول - العلوم / English Quiz 1"
                className="h-11 rounded-2xl text-right"
                maxLength={200}
              />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="المادة *"
                error={form.formState.errors.subject?.message}
              >
                <Input
                  {...form.register('subject')}
                  placeholder="مثال: العلوم، English، الرياضيات..."
                  className="h-11 rounded-2xl text-right"
                  maxLength={100}
                />
              </FormField>
              <FormField
                label="لغة الاختبار *"
              >
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => form.setValue('language', 'ar')}
                    className={cn(
                      'flex-1 h-11 rounded-2xl text-xs font-black border-2 transition-all',
                      currentLanguage === 'ar'
                        ? 'bg-violet-50 border-violet-600 text-violet-900 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                    )}
                  >
                    🇸🇦 عربي (RTL)
                  </button>
                  <button
                    type="button"
                    onClick={() => form.setValue('language', 'en')}
                    className={cn(
                      'flex-1 h-11 rounded-2xl text-xs font-black border-2 transition-all',
                      currentLanguage === 'en'
                        ? 'bg-violet-50 border-violet-600 text-violet-900 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                    )}
                  >
                    🇬🇧 English (LTR)
                  </button>
                </div>
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="المدة الزمنية لحل الاختبار (بالدقائق) *"
                error={form.formState.errors.duration_minutes?.message}
              >
                <Input
                  {...form.register('duration_minutes')}
                  type="number"
                  min={1}
                  max={180}
                  placeholder="30"
                  className="h-11 rounded-2xl text-right"
                />
              </FormField>
              <FormField
                label="موعد إغلاق وانتهاء الاختبار (اختياري / Deadline)"
                error={form.formState.errors.available_until?.message}
              >
                <Input
                  {...form.register('available_until')}
                  type="datetime-local"
                  className="h-11 rounded-2xl text-right bg-slate-50"
                />
              </FormField>
            </div>
            <FormField
              label="تعليمات الاختبار (اختياري)"
              error={form.formState.errors.instructions?.message}
            >
              <textarea
                {...form.register('instructions')}
                placeholder="اكتب تعليمات للطلاب هنا..."
                rows={3}
                maxLength={1000}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white px-4 py-3 text-sm font-medium text-right resize-none outline-none focus:border-violet-400 transition-colors"
              />
            </FormField>
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={createExam.isPending || updateExam.isPending}
                className="h-11 px-8 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black gap-2"
              >
                {(createExam.isPending || updateExam.isPending)
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</>
                  : 'حفظ والمتابعة →'
                }
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ── Step 2: Questions ── */}
      {step === 'questions' && (
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <QuestionEditor
              key={q._key}
              index={idx}
              total={questions.length}
              question={q}
              examLanguage={currentLanguage}
              onChange={patch => updateQuestion(idx, patch)}
              onChangeType={type => changeType(idx, type)}
              onMoveUp={() => moveUp(idx)}
              onMoveDown={() => moveDown(idx)}
              onDelete={() => setDeleteIdx(idx)}
            />
          ))}

          {/* Add question */}
          {questions.length < 50 ? (
            <button
              onClick={addQuestion}
              className="w-full flex items-center justify-center gap-2 h-12 rounded-[28px] border-2 border-dashed border-violet-200 text-violet-500 text-sm font-black hover:border-violet-400 hover:bg-violet-50 transition-all"
            >
              <Plus className="w-4 h-4" />
              إضافة سؤال آخر
            </button>
          ) : (
            <div className="text-center py-3 text-xs font-bold text-slate-400 bg-slate-50 rounded-2xl">
              تم الوصول للحد الأقصى (50 سؤال)
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => setStep('info')}
              className="flex-1 h-11 rounded-2xl border border-slate-200 text-slate-600 font-black text-sm hover:bg-slate-50 transition-colors"
            >
              ← السابق
            </button>
            <button
              onClick={() => handleSaveQuestions(false)}
              disabled={saveQuestions.isPending || questions.length === 0}
              className="flex-1 flex items-center justify-center gap-2 h-11 rounded-2xl bg-slate-100 text-slate-700 font-black text-sm hover:bg-slate-200 disabled:opacity-50 transition-colors"
            >
              {saveQuestions.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</>
                : <><Eye className="w-4 h-4" /> معاينة الاختبار</>
              }
            </button>
            <button
              onClick={() => handleSaveQuestions(true)}
              disabled={saveQuestions.isPending || isPublishing || questions.length === 0}
              className="flex-1 flex items-center justify-center gap-2 h-11 rounded-2xl bg-violet-600 text-white font-black text-sm hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {isPublishing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري النشر...</>
                : <><Send className="w-4 h-4" /> نشر الاختبار</>
              }
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Preview ── */}
      {step === 'preview' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-100 rounded-[28px] p-6">
            <div className="flex items-center gap-2 mb-5">
              <Eye className="w-5 h-5 text-violet-500" />
              <h3 className="font-black text-slate-900">معاينة الاختبار (كما سيراه الطالب)</h3>
              <Badge className="bg-violet-50 text-violet-600 border-none text-[10px] font-black rounded-lg">
                وضع معاينة — لا يُحتسب وقت
              </Badge>
            </div>
            <div className="space-y-4">
              {questions.map((q, idx) => (
                <PreviewQuestion key={q._key} index={idx} question={q} examLanguage={currentLanguage} />
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setStep('questions')}
              className="flex-1 h-11 rounded-2xl border border-slate-200 text-slate-600 font-black text-sm hover:bg-slate-50 transition-colors"
            >
              إغلاق المعاينة / تعديل
            </button>
            <button
              onClick={handlePublishFromPreview}
              disabled={isPublishing}
              className="flex-1 flex items-center justify-center gap-2 h-11 rounded-2xl bg-violet-600 text-white font-black text-sm hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {isPublishing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري النشر...</>
                : <><Send className="w-4 h-4" /> نشر الاختبار</>
              }
            </button>
          </div>
        </div>
      )}

      {/* Delete question dialog */}
      <AlertDialog open={deleteIdx !== null} onOpenChange={open => !open && setDeleteIdx(null)}>
        <AlertDialogContent dir="rtl" className="rounded-[28px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black text-slate-900">حذف السؤال</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 font-medium">
              هل أنت متأكد من حذف هذا السؤال؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel className="rounded-2xl font-black">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteIdx !== null && removeQuestion(deleteIdx)}
              className="rounded-2xl bg-rose-600 hover:bg-rose-700 font-black"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Question Editor ──────────────────────────────────────────────────────────

function QuestionEditor({
  index, total, question, examLanguage, onChange, onChangeType, onMoveUp, onMoveDown, onDelete,
}: {
  index: number;
  total: number;
  question: LocalQuestion;
  examLanguage: 'ar' | 'en';
  onChange: (patch: Partial<LocalQuestion>) => void;
  onChangeType: (type: QuestionType) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  const isEn = examLanguage === 'en' || isEnglishText(question.question_text);
  const letters = isEn ? ['A', 'B', 'C', 'D'] : ['أ', 'ب', 'ج', 'د'];

  const TYPES: { value: QuestionType; label: string }[] = [
    { value: 'true_false',      label: isEn ? 'True / False' : 'صح / غلط' },
    { value: 'multiple_choice', label: isEn ? 'Multiple Choice' : 'اختيار متعدد' },
    { value: 'fill_blank',      label: isEn ? 'Fill in Blank' : 'إكمال فراغ' },
  ];

  return (
    <div className="bg-white border border-slate-100 rounded-[28px] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-slate-500 bg-slate-50 rounded-xl px-3 py-1">
            {isEn ? `Question ${index + 1}` : `سؤال ${index + 1}`}
          </span>
          {isEn && (
            <Badge variant="outline" className="text-[10px] font-bold text-violet-600 border-violet-200 bg-violet-50">
              LTR / English
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-50 disabled:opacity-30 transition-colors"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-50 disabled:opacity-30 transition-colors"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-rose-400 hover:bg-rose-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Type selector */}
      <div className="flex gap-2">
        {TYPES.map(t => (
          <button
            key={t.value}
            onClick={() => onChangeType(t.value)}
            className={cn(
              'flex-1 h-9 rounded-2xl text-xs font-black transition-all border',
              question.question_type === t.value
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-violet-200'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Question text */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {isEn ? 'Question Text *' : 'نص السؤال *'}
          {question.question_type === 'fill_blank' && (
            <span className="mr-2 text-violet-500 normal-case">
              {isEn ? 'Use ___ for the blank' : 'استخدم ___ للفراغ'}
            </span>
          )}
        </label>
        <textarea
          dir={isEn ? 'ltr' : 'rtl'}
          value={question.question_text}
          onChange={e => onChange({ question_text: e.target.value })}
          placeholder={
            question.question_type === 'fill_blank'
              ? (isEn ? 'e.g. The capital of Egypt is ___' : 'مثال: العاصمة المصرية هي ___ ')
              : (isEn ? 'Write question here...' : 'اكتب نص السؤال هنا...')
          }
          rows={2}
          maxLength={500}
          className={cn(
            "w-full rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white px-4 py-3 text-sm font-medium resize-none outline-none focus:border-violet-400 transition-colors",
            isEn ? "text-left" : "text-right"
          )}
        />
      </div>

      {/* Type-specific fields */}
      {question.question_type === 'true_false' && (
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {isEn ? 'Correct Answer *' : 'الإجابة الصحيحة *'}
          </label>
          <div className="flex gap-3">
            {(['true', 'false'] as const).map(val => (
              <button
                key={val}
                type="button"
                onClick={() => onChange({ correct_answer: val })}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 h-10 rounded-2xl text-sm font-black border-2 transition-all',
                  question.correct_answer === val
                    ? val === 'true' ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-rose-50 border-rose-400 text-rose-700'
                    : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200'
                )}
              >
                {val === 'true' 
                  ? <><CheckCircle2 className="w-4 h-4" /> {isEn ? 'True' : 'صح'}</> 
                  : <><XCircle className="w-4 h-4" /> {isEn ? 'False' : 'غلط'}</>
                }
              </button>
            ))}
          </div>
        </div>
      )}

      {question.question_type === 'multiple_choice' && (
        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {isEn ? 'Options (A, B, C, D) *' : 'الخيارات (أ، ب، ج، د) *'}
          </label>
          {question.options.map((opt, oi) => {
            const isCorrect = question.correct_answer === opt && opt.trim() !== '';
            return (
              <div key={oi} dir={isEn ? 'ltr' : 'rtl'} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => opt.trim() && onChange({ correct_answer: opt })}
                  className={cn(
                    'w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 border-2 transition-all',
                    isCorrect
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-violet-300'
                  )}
                  title={isEn ? 'Click to mark as correct answer' : 'اضغط لتحديد كإجابة صحيحة'}
                >
                  {letters[oi]}
                </button>
                <Input
                  dir={isEn ? 'ltr' : 'rtl'}
                  value={opt}
                  onChange={e => {
                    const newOpts = [...question.options] as [string, string, string, string];
                    newOpts[oi] = e.target.value;
                    const newCorrect = question.correct_answer === question.options[oi]
                      ? e.target.value
                      : question.correct_answer;
                    onChange({ options: newOpts, correct_answer: newCorrect });
                  }}
                  placeholder={isEn ? `Option ${letters[oi]}` : `الخيار ${letters[oi]}`}
                  maxLength={200}
                  className={cn("h-9 rounded-2xl text-sm flex-1", isEn ? "text-left" : "text-right")}
                />
              </div>
            );
          })}
          {!question.correct_answer && (
            <p className="text-[10px] text-violet-500 font-bold">
              {isEn ? 'Click the option letter to mark it as the correct answer' : 'اضغط على حرف الخيار لتحديده كإجابة صحيحة'}
            </p>
          )}
        </div>
      )}

      {question.question_type === 'fill_blank' && (
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {isEn ? 'Correct Answer *' : 'الإجابة الصحيحة *'}
          </label>
          <Input
            dir={isEn ? 'ltr' : 'rtl'}
            value={question.correct_answer}
            onChange={e => onChange({ correct_answer: e.target.value })}
            placeholder={isEn ? 'Correct answer for the blank' : 'الإجابة الصحيحة للفراغ'}
            maxLength={200}
            className={cn("h-10 rounded-2xl", isEn ? "text-left" : "text-right")}
          />
        </div>
      )}
    </div>
  );
}

// ─── Preview Question ──────────────────────────────────────────────────────────

function PreviewQuestion({ index, question, examLanguage }: { index: number; question: LocalQuestion; examLanguage: 'ar' | 'en' }) {
  const isEn = examLanguage === 'en' || isEnglishText(question.question_text);
  const letters = isEn ? ['A', 'B', 'C', 'D'] : ['أ', 'ب', 'ج', 'د'];

  return (
    <div dir={isEn ? 'ltr' : 'rtl'} className="border border-slate-100 rounded-2xl p-4 space-y-3">
      <p className={cn("text-sm font-black text-slate-900", isEn ? "text-left" : "text-right")}>
        <span className={cn("text-violet-500", isEn ? "mr-2" : "ml-2")}>{index + 1}.</span>
        {question.question_text || (isEn ? '(Question text)' : '(نص السؤال)')}
      </p>

      {question.question_type === 'true_false' && (
        <div className="flex gap-3">
          {(['true', 'false'] as const).map(val => (
            <div
              key={val}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 h-9 rounded-xl text-sm font-black border-2',
                question.correct_answer === val
                  ? val === 'true' ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-rose-50 border-rose-400 text-rose-700'
                  : 'bg-slate-50 border-slate-100 text-slate-400'
              )}
            >
              {val === 'true' ? (isEn ? '✓ True' : '✓ صح') : (isEn ? '✗ False' : '✗ غلط')}
              {question.correct_answer === val && (
                <span className="text-[9px] font-black bg-white/60 px-1 rounded">
                  {isEn ? '✓ Correct' : '✓ صحيحة'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {question.question_type === 'multiple_choice' && (
        <div className="grid grid-cols-2 gap-2">
          {question.options.map((opt, oi) => (
            <div
              key={oi}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold border-2',
                question.correct_answer === opt && opt.trim()
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                  : 'bg-slate-50 border-slate-100 text-slate-600'
              )}
            >
              <span className="text-xs font-black text-slate-400">{letters[oi]}</span>
              <span className="flex-1">{opt || '—'}</span>
              {question.correct_answer === opt && opt.trim() && (
                <span className="text-[9px] text-emerald-600 font-black">✓</span>
              )}
            </div>
          ))}
        </div>
      )}

      {question.question_type === 'fill_blank' && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
          <span className="text-xs font-bold text-slate-500">{isEn ? 'Answer:' : 'الإجابة:'}</span>
          <span className="text-sm font-black text-emerald-700">{question.correct_answer || '—'}</span>
        </div>
      )}
    </div>
  );
}

// ─── Form Field ───────────────────────────────────────────────────────────────

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
      {children}
      {error && <p className="text-xs text-rose-500 font-bold">{error}</p>}
    </div>
  );
}
