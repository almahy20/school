import { useState, useEffect, useRef, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { ArrowRight, ArrowLeft, Clock, CheckCircle2, XCircle, AlertCircle, Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useExamQuestions,
  useSubmitExamAttempt,
  type ElectronicExam,
  type ExamQuestion,
} from '@/hooks/queries/useElectronicExams';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ExamTakingViewProps {
  exam: ElectronicExam;
  studentId: string;
  studentName: string;
  onFinish: () => void;
  onBack: () => void;
}

type Screen = 'confirm' | 'taking' | 'result';

interface SubmitResult {
  score: number;
  totalScore: number;
  questions: ExamQuestion[];
  answers: Record<string, string>;
}

export default function ExamTakingView({ exam, studentId, studentName, onFinish, onBack }: ExamTakingViewProps) {
  const [screen, setScreen] = useState<Screen>('confirm');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(exam.duration_minutes * 60);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: questions = [], isLoading: qLoading } = useExamQuestions(exam.id);
  const submitAttempt = useSubmitExamAttempt();

  // Timer
  useEffect(() => {
    if (screen !== 'taking') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [screen]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleStart = () => {
    startTimeRef.current = Date.now();
    setTimeLeft(exam.duration_minutes * 60);
    setScreen('taking');
  };

  const handleSubmit = useCallback(async (auto = false) => {
    clearInterval(timerRef.current!);
    const spent = Math.round((Date.now() - startTimeRef.current) / 1000);

    try {
      const result = await submitAttempt.mutateAsync({
        examId: exam.id,
        studentId,
        answers,
        timeSpentSeconds: spent,
        questions,
      });
      setSubmitResult({
        score: result.score,
        totalScore: result.totalScore,
        questions: result.questions,
        answers,
      });
      setScreen('result');
      if (auto) toast.info('انتهى وقت الاختبار — تم إرسال إجاباتك تلقائياً');
    } catch (_) {}
    setShowEndDialog(false);
  }, [answers, questions, exam.id, studentId, submitAttempt]);

  // ── Confirm Screen ────────────────────────────────────────────────────────
  if (screen === 'confirm') {
    return (
      <AppLayout>
        <div className="max-w-[600px] mx-auto px-4 md:px-0 pb-20 pt-8 animate-in fade-in duration-500" dir="rtl">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-black text-slate-400 hover:text-slate-900 transition-colors mb-6"
          >
            <ArrowRight className="w-4 h-4" />
            العودة للاختبارات
          </button>
          <div className="bg-white border border-slate-100 rounded-[32px] p-8 space-y-6 shadow-sm">
            <div className="w-16 h-16 rounded-[24px] bg-violet-50 flex items-center justify-center">
              <Clock className="w-8 h-8 text-violet-600" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-black text-slate-900">{exam.title}</h1>
              <p className="text-sm text-slate-500 font-bold">{exam.subject}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="الطالب" value={studentName} />
              <InfoRow label="عدد الأسئلة" value={`${exam.questions_count || questions.length} سؤال`} />
              <InfoRow label="المدة الزمنية" value={`${exam.duration_minutes} دقيقة`} />
              <InfoRow label="النوع" value="تصحيح تلقائي" />
            </div>
            {exam.instructions && (
              <div className="bg-slate-50 rounded-2xl p-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">تعليمات</p>
                <p className="text-sm font-medium text-slate-700 leading-relaxed">{exam.instructions}</p>
              </div>
            )}
            <button
              onClick={handleStart}
              disabled={qLoading}
              className="w-full h-13 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-base flex items-center justify-center gap-3 transition-colors disabled:opacity-50"
              style={{ height: '52px' }}
            >
              {qLoading ? <><Loader2 className="w-5 h-5 animate-spin" /> جاري التحميل...</> : 'ابدأ الاختبار الآن'}
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Taking Screen ─────────────────────────────────────────────────────────
  if (screen === 'taking') {
    const q = questions[currentQ];
    const isLowTime = timeLeft < 120;
    const answered = Object.keys(answers).length;

    if (!q) return null;

    return (
      <AppLayout>
        <div className="max-w-[700px] mx-auto px-4 md:px-0 pb-20 pt-4 animate-in fade-in duration-300" dir="rtl">
          {/* Timer bar */}
          <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 py-3 -mx-4 mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500">{exam.title}</span>
              <span className="text-[10px] font-black text-slate-300">
                {answered}/{questions.length} مجاب
              </span>
            </div>
            <div className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-2xl font-black text-sm transition-all',
              isLowTime ? 'bg-rose-50 text-rose-600 animate-pulse' : 'bg-slate-50 text-slate-700'
            )}>
              <Clock className="w-4 h-4" />
              {formatTime(timeLeft)}
            </div>
          </div>

          {/* Progress */}
          <div className="mb-5 space-y-2">
            <div className="flex justify-between text-xs font-black text-slate-400">
              <span>السؤال {currentQ + 1} من {questions.length}</span>
              <span>{Math.round(((currentQ + 1) / questions.length) * 100)}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all duration-500"
                style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Question */}
          <div className="bg-white border border-slate-100 rounded-[28px] p-6 space-y-5">
            <p className="text-base font-black text-slate-900 leading-relaxed">{q.question_text}</p>

            {q.question_type === 'true_false' && (
              <div className="flex gap-3">
                {(['true', 'false'] as const).map(val => {
                  const isSelected = answers[q.id] === val;
                  return (
                    <button
                      key={val}
                      onClick={() => setAnswers(prev => ({ ...prev, [q.id]: val }))}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl text-sm font-black border-2 transition-all',
                        isSelected
                          ? val === 'true' ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-rose-500 border-rose-500 text-white'
                          : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-violet-300'
                      )}
                    >
                      {val === 'true' ? '✓ صح' : '✗ غلط'}
                    </button>
                  );
                })}
              </div>
            )}

            {q.question_type === 'multiple_choice' && (
              <div className="space-y-2">
                {(q.options as string[]).map((opt, oi) => {
                  const letters = ['أ', 'ب', 'ج', 'د'];
                  const isSelected = answers[q.id] === opt;
                  return (
                    <button
                      key={oi}
                      onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold border-2 text-right transition-all',
                        isSelected
                          ? 'bg-violet-600 border-violet-600 text-white'
                          : 'bg-slate-50 border-slate-100 text-slate-700 hover:border-violet-300 hover:bg-violet-50/40'
                      )}
                    >
                      <span className={cn(
                        'w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 border',
                        isSelected ? 'bg-white/20 border-white/30 text-white' : 'bg-white border-slate-200 text-slate-500'
                      )}>
                        {letters[oi]}
                      </span>
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            {q.question_type === 'fill_blank' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">إجابتك</label>
                <input
                  value={answers[q.id] || ''}
                  onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="اكتب إجابتك هنا..."
                  className="w-full h-12 rounded-2xl border-2 border-slate-200 bg-slate-50 focus:bg-white focus:border-violet-400 px-4 text-sm font-bold text-right outline-none transition-colors"
                />
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={() => setCurrentQ(p => Math.max(0, p - 1))}
              disabled={currentQ === 0}
              className="flex-1 h-11 rounded-2xl border border-slate-200 text-slate-600 font-black text-sm hover:bg-slate-50 disabled:opacity-30 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              السابق
            </button>
            {currentQ < questions.length - 1 ? (
              <button
                onClick={() => setCurrentQ(p => Math.min(questions.length - 1, p + 1))}
                className="flex-1 h-11 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-sm transition-colors flex items-center justify-center gap-2"
              >
                التالي
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setShowEndDialog(true)}
                className="flex-1 h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                إنهاء الاختبار
              </button>
            )}
          </div>

          {/* Question dots */}
          <div className="flex flex-wrap gap-1.5 justify-center mt-5">
            {questions.map((question, i) => (
              <button
                key={question.id}
                onClick={() => setCurrentQ(i)}
                className={cn(
                  'w-7 h-7 rounded-lg text-[10px] font-black transition-all',
                  i === currentQ ? 'bg-violet-600 text-white' :
                  answers[question.id] ? 'bg-emerald-100 text-emerald-700' :
                  'bg-slate-100 text-slate-400 hover:bg-slate-200'
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        {/* End confirmation */}
        <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
          <AlertDialogContent dir="rtl" className="rounded-[28px]">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-black text-slate-900">إنهاء الاختبار؟</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-500 font-medium">
                أجبت على {answered} من {questions.length} سؤال.
                {answered < questions.length && ` الأسئلة غير المجابة (${questions.length - answered}) ستُعدّ خطأ.`}
                <br />هل تريد إرسال الاختبار الآن؟
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row-reverse gap-2">
              <AlertDialogCancel className="rounded-2xl font-black">العودة للاختبار</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleSubmit(false)}
                disabled={submitAttempt.isPending}
                className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 font-black"
              >
                {submitAttempt.isPending ? <><Loader2 className="w-4 h-4 animate-spin ml-2" />جاري الإرسال...</> : 'نعم، إرسال'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AppLayout>
    );
  }

  // ── Result Screen ─────────────────────────────────────────────────────────
  if (screen === 'result' && submitResult) {
    const { score, totalScore, questions: qs, answers: ans } = submitResult;
    const pct = Math.round((score / (totalScore || 1)) * 100);

    return (
      <AppLayout>
        <div className="max-w-[700px] mx-auto px-4 md:px-0 pb-20 pt-8 animate-in fade-in duration-500" dir="rtl">
          {/* Result header */}
          <div className={cn(
            'rounded-[32px] p-8 text-white text-center space-y-3 mb-6',
            pct >= 80 ? 'bg-emerald-600' : pct >= 60 ? 'bg-amber-500' : 'bg-rose-500'
          )}>
            <div className="text-5xl font-black">{pct}%</div>
            <div className="text-xl font-black">{score} / {totalScore}</div>
            <div className="text-white/80 text-sm font-bold">
              {pct >= 80 ? '🎉 ممتاز!' : pct >= 60 ? '👍 جيد' : '💪 حاول مرة أخرى'}
            </div>
          </div>

          {/* Detailed correction */}
          <div className="space-y-3 mb-6">
            <h3 className="font-black text-slate-900">التصحيح التفصيلي</h3>
            {qs.map((q, i) => {
              const given = ans[q.id] || '';
              const isCorrect = given.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
              return (
                <div
                  key={q.id}
                  className={cn(
                    'rounded-[24px] p-4 border-2 space-y-2',
                    isCorrect ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'
                  )}
                >
                  <div className="flex items-start gap-2">
                    {isCorrect
                      ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      : <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    }
                    <p className="text-sm font-bold text-slate-900">
                      <span className="text-slate-400 ml-1">{i + 1}.</span>
                      {q.question_text}
                    </p>
                  </div>
                  {!isCorrect && (
                    <div className="mr-7 space-y-1">
                      <p className="text-xs font-bold text-rose-600">
                        إجابتك: {renderAnswer(q, given)}
                      </p>
                      <p className="text-xs font-bold text-emerald-700">
                        الإجابة الصحيحة: {renderAnswer(q, q.correct_answer)}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={onFinish}
            className="w-full h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm transition-colors"
          >
            العودة للاختبارات
          </button>
        </div>
      </AppLayout>
    );
  }

  return null;
}

function renderAnswer(q: ExamQuestion, value: string): string {
  if (q.question_type === 'true_false') {
    return value === 'true' ? 'صح ✓' : value === 'false' ? 'غلط ✗' : '(لم يجب)';
  }
  return value || '(لم يجب)';
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-2xl p-3">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}
