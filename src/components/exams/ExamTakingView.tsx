import React from 'react';
import AppLayout from '@/components/AppLayout';
import {
  ArrowRight, Clock, XCircle,
  AlertCircle, Loader2, Check, Sparkles,
  ShieldAlert, BookOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  isEnglishText,
  type ElectronicExam,
  type ExamQuestion,
} from '@/hooks/queries/useElectronicExams';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useExamRunner } from '@/hooks/useExamRunner';
import { QuestionCard } from '@/components/exams/QuestionCard';
import { ExamFooterActions } from '@/components/exams/ExamFooterActions';

interface ExamTakingViewProps {
  exam: ElectronicExam;
  studentId: string;
  studentName: string;
  onFinish: () => void;
  onBack: () => void;
}

export default function ExamTakingView({ exam, studentId, studentName, onFinish, onBack }: ExamTakingViewProps) {
  const {
    screen,
    currentQ,
    answers,
    timeLeft,
    showEndDialog,
    setShowEndDialog,
    submitResult,
    tabSwitchCount,
    showCheatWarning,
    setShowCheatWarning,
    cheatWarningMsg,
    questions,
    qLoading,
    isExpired,
    isNotStarted,
    isSubmitting,
    formatTime,
    updateAnswer,
    navigateToQ,
    handleStart,
    handleSubmit,
  } = useExamRunner({ exam, studentId });

  // ── Confirm Screen ────────────────────────────────────────────────────────
  if (screen === 'confirm') {
    return (
      <AppLayout>
        <div className="max-w-[650px] mx-auto px-4 md:px-0 pb-20 pt-8 animate-in fade-in duration-500" dir="rtl">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-black text-slate-400 hover:text-slate-900 transition-colors mb-6 group"
          >
            <ArrowRight className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            العودة لقائمة الاختبارات
          </button>

          <div className="bg-white border border-slate-100 rounded-[36px] p-7 md:p-10 space-y-7 shadow-xl shadow-slate-100/70 relative overflow-hidden">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-[24px] bg-violet-100/80 flex items-center justify-center text-violet-600 shadow-inner shrink-0">
                <Clock className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black text-slate-900 leading-tight">{exam.title}</h1>
                  {exam.language === 'en' && (
                    <Badge variant="outline" className="text-[10px] font-bold text-violet-600 border-violet-200 bg-violet-50">
                      English
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-violet-600 font-black mt-1 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  مادة {exam.subject}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <InfoRow label="اسم الطالب" value={studentName} />
              <InfoRow label="عدد الأسئلة" value={`${exam.questions_count || questions.length} سؤال`} />
              <InfoRow label="مدة الحل" value={`${exam.duration_minutes} دقيقة`} />
              {exam.available_until ? (
                <InfoRow 
                  label="متاح حتى" 
                  value={new Date(exam.available_until).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })} 
                />
              ) : (
                <InfoRow label="طريقة التصحيح" value="تصحيح فوري تلقائي" />
              )}
            </div>

            {isExpired && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 space-y-1">
                <div className="flex items-center gap-2 text-rose-700 font-black">
                  <XCircle className="w-5 h-5" />
                  <span>انتهت فترة تقديم هذا الاختبار</span>
                </div>
                <p className="text-xs font-bold text-rose-800">
                  لقد انتهى الموعد النهائي المحدد لهذا الاختبار ولم يعد بإمكانك الإجابة عليه.
                </p>
              </div>
            )}

            {isNotStarted && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-1">
                <div className="flex items-center gap-2 text-amber-700 font-black">
                  <AlertCircle className="w-5 h-5" />
                  <span>لم تبدأ فترة الاختبار بعد</span>
                </div>
                <p className="text-xs font-bold text-amber-800">
                  سيكون هذا الاختبار متاحاً للبدء في موعده المحدد.
                </p>
              </div>
            )}

            {exam.instructions && (
              <div className="bg-amber-50/70 border border-amber-200/60 rounded-2xl p-5 space-y-2">
                <div className="flex items-center gap-2 text-amber-700">
                  <AlertCircle className="w-4 h-4" />
                  <p className="text-xs font-black uppercase tracking-wider">تعليمات هامة للاختبار</p>
                </div>
                <p className="text-sm font-bold text-amber-900 leading-relaxed whitespace-pre-wrap">{exam.instructions}</p>
              </div>
            )}

            <button
              onClick={handleStart}
              disabled={qLoading || (questions.length === 0 && !qLoading) || isExpired || isNotStarted}
              className="w-full h-14 rounded-2xl bg-violet-600 hover:bg-violet-700 active:scale-[0.99] text-white font-black text-lg flex items-center justify-center gap-3 transition-all shadow-lg shadow-violet-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {qLoading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  جاري تجهيز الأسئلة...
                </>
              ) : isExpired ? (
                'انتهى موعد الاختبار'
              ) : isNotStarted ? (
                'يبدأ الاختبار قريباً'
              ) : questions.length === 0 ? (
                'لا توجد أسئلة مضافة في هذا الاختبار'
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  ابدأ الاختبار الآن
                </>
              )}
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
    const answeredCount = Object.keys(answers).filter(k => answers[k]?.trim() !== '').length;

    if (!q) return null;

    return (
      <div
        className="min-h-screen bg-slate-50/80 text-slate-900 flex flex-col justify-start py-4 px-4 sm:px-6 select-none"
        dir="rtl"
        onCopy={e => e.preventDefault()}
        onCut={e => e.preventDefault()}
        onPaste={e => e.preventDefault()}
        onContextMenu={e => e.preventDefault()}
        style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
      >
        {/* Anti-Cheat Warning Banner (shows after each tab switch) */}
        {showCheatWarning && (
          <div className="max-w-[800px] w-full mx-auto mb-4 bg-rose-50 border-2 border-rose-400 rounded-2xl p-4 flex items-start gap-3 animate-in slide-in-from-top duration-300 z-50 shadow-lg shadow-rose-100">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-black text-rose-800">{cheatWarningMsg}</p>
            </div>
            <button
              onClick={() => setShowCheatWarning(false)}
              className="text-rose-500 hover:text-rose-700 font-black text-xs shrink-0 cursor-pointer"
            >
              ✕ إغلاق
            </button>
          </div>
        )}

        <div className="max-w-[800px] w-full mx-auto pb-24 pt-2 animate-in fade-in duration-300">

          {/* Header Bar */}
          <div className="sticky top-2 z-30 bg-white/95 backdrop-blur-md border border-slate-100 rounded-3xl px-5 py-3.5 mb-6 shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center font-black text-sm shrink-0">
                {currentQ + 1}/{questions.length}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900 truncate">{exam.title}</p>
                <p className="text-[11px] font-bold text-slate-400">
                  تمت الإجابة على <span className="text-violet-600 font-black">{answeredCount}</span> من {questions.length}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Tab-switch integrity badge */}
              {tabSwitchCount > 0 && (
                <div className={cn(
                  'hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border',
                  tabSwitchCount >= 2
                    ? 'bg-rose-50 text-rose-700 border-rose-300'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                )}>
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {tabSwitchCount} مخالفة
                </div>
              )}

              <div className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-2xl font-black text-sm md:text-base transition-all border',
                isLowTime
                  ? 'bg-rose-50 border-rose-200 text-rose-600 animate-pulse ring-2 ring-rose-300/50'
                  : 'bg-slate-50 border-slate-200/80 text-slate-800'
              )}>
                <Clock className={cn('w-4 h-4', isLowTime ? 'text-rose-600' : 'text-slate-500')} />
                <span className="font-mono tracking-wider">{formatTime(timeLeft)}</span>
              </div>

              <button
                onClick={() => setShowEndDialog(true)}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 text-xs font-black transition-colors"
                title="إنهاء الاختبار"
              >
                إنهاء
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6 space-y-2 bg-white border border-slate-100 rounded-2xl p-3 shadow-sm">
            <div className="flex justify-between items-center text-xs font-black text-slate-500">
              <span>السؤال {currentQ + 1} من {questions.length}</span>
              <span className="text-violet-600 font-black">{Math.round(((currentQ + 1) / questions.length) * 100)}% مكتمل</span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-l from-violet-500 to-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Question Card Component */}
          <QuestionCard
            question={q}
            questionIndex={currentQ}
            answer={answers[q.id] || ''}
            onAnswerChange={(val) => updateAnswer(q.id, val)}
            isEnglishExam={exam.language === 'en'}
          />

          {/* Navigation Controls & Dots Component */}
          <ExamFooterActions
            currentQ={currentQ}
            totalQuestions={questions.length}
            questions={questions}
            answers={answers}
            onNavigate={navigateToQ}
            onSubmitClick={() => setShowEndDialog(true)}
          />
        </div>

        {/* End confirmation Modal */}
        <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
          <AlertDialogContent dir="rtl" className="rounded-[32px] p-7 max-w-md">
            <AlertDialogHeader className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto sm:mx-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <AlertDialogTitle className="font-black text-slate-900 text-xl">هل أنت متأكد من إنهاء الاختبار؟</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-600 font-bold text-sm leading-relaxed">
                لقد أجبت على <span className="text-violet-600 font-black">{answeredCount}</span> من إجمالي <span className="font-black">{questions.length}</span> سؤال.
                {answeredCount < questions.length && (
                  <div className="mt-2 text-rose-600 font-black bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                    ⚠️ لديك ({questions.length - answeredCount}) أسئلة غير مجابة وستُعتبر إجاباتها خاطئة.
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row-reverse gap-3 mt-4">
              <AlertDialogCancel className="rounded-2xl font-black h-12 flex-1 border-slate-200">
                العودة للمراجعة
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleSubmit(false)}
                disabled={isSubmitting}
                className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 font-black h-12 flex-1 text-white shadow-lg shadow-emerald-200"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin ml-2" />
                    جاري الإرسال...
                  </>
                ) : (
                  'نعم، إرسال الاختبار'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ── Result Screen ─────────────────────────────────────────────────────────
  if (screen === 'result' && submitResult) {
    const { score, totalScore, questions: qs, answers: ans } = submitResult;
    const pct = Math.round((score / (totalScore || 1)) * 100);

    return (
      <AppLayout>
        <div className="max-w-[780px] mx-auto px-4 md:px-0 pb-20 pt-8 animate-in fade-in duration-500" dir="rtl">
          {/* Result Header Card */}
          <div className={cn(
            'rounded-[36px] p-8 md:p-10 text-white text-center space-y-4 mb-8 shadow-2xl relative overflow-hidden',
            pct >= 80 ? 'bg-gradient-to-br from-emerald-500 to-teal-700 shadow-emerald-200' :
            pct >= 60 ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-200' :
            'bg-gradient-to-br from-rose-500 to-red-700 shadow-rose-200'
          )}>
            <div className="text-6xl md:text-7xl font-black tracking-tight">{pct}%</div>
            <div className="text-2xl font-black">الدرجة: {score} من {totalScore}</div>
            <div className="text-white/95 text-base font-black bg-white/20 backdrop-blur-md px-6 py-2 rounded-2xl w-fit mx-auto">
              {pct >= 80 ? '🎉 نتيجة ممتازة! أحسنت صنعاً' : pct >= 60 ? '👍 نتيجة جيدة! استمر في المحاولة' : '💪 لا بأس، حاول مرة أخرى لتحسين نتيجتك'}
            </div>
          </div>

          {/* Integrity Report Badge — Only displayed if student committed infractions */}
          {tabSwitchCount > 0 && (() => {
            const isSevere = tabSwitchCount >= 3;
            return (
              <div className={cn(
                'rounded-[24px] p-5 text-white flex items-center gap-4 mb-4 shadow-lg',
                isSevere ? 'bg-gradient-to-l from-rose-600 to-red-700' : 'bg-gradient-to-l from-amber-500 to-orange-600'
              )}>
                <span className="text-3xl">{isSevere ? '🚨' : '⚠️'}</span>
                <div className="flex-1">
                  <p className="font-black text-base">{isSevere ? 'اشتباه بمحاولة غش' : 'تنبيه أمني أثناء الاختبار'}</p>
                  <p className="text-sm text-white/90 font-bold mt-0.5">
                    {isSevere
                      ? `تم رصد ${tabSwitchCount} محاولات مغادرة لشاشة الاختبار`
                      : `تم رصد مغادرة شاشة الاختبار (${tabSwitchCount} مرة)`}
                  </p>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-2 text-center border border-white/20">
                  <p className="text-xl font-black">{tabSwitchCount}</p>
                  <p className="text-[10px] font-bold text-white/80">مخالفات</p>
                </div>
              </div>
            );
          })()}

          {/* Detailed Correction Breakdown */}
          <div className="bg-white border border-slate-100 rounded-[32px] p-6 sm:p-8 space-y-6 shadow-sm mb-6">
            <h3 className="font-black text-slate-900 text-lg border-b border-slate-100 pb-4">
              التصحيح التفصيلي للإجابات ({qs.length} أسئلة)
            </h3>

            <div className="space-y-4">
              {qs.map((q, i) => {
                const given = ans[q.id] || '';
                const isCorrect = given.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
                const qIsEn = exam.language === 'en' || isEnglishText(q.question_text);

                return (
                  <div
                    key={q.id}
                    className={cn(
                      'rounded-[24px] p-5 border-2 space-y-3 transition-all',
                      isCorrect
                        ? 'bg-emerald-50/40 border-emerald-200/90'
                        : 'bg-rose-50/40 border-rose-200/90'
                    )}
                  >
                    <div dir={qIsEn ? 'ltr' : 'rtl'} className="flex items-start gap-3">
                      {isCorrect ? (
                        <div className="w-7 h-7 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                          <XCircle className="w-4 h-4" />
                        </div>
                      )}
                      <p className={cn("text-base font-black text-slate-900 leading-relaxed flex-1", qIsEn ? "text-left font-sans" : "text-right")}>
                        <span className="text-slate-400 font-mono mx-1.5">#{i + 1}</span>
                        {q.question_text}
                      </p>
                    </div>

                    <div dir={qIsEn ? 'ltr' : 'rtl'} className="space-y-1.5 pt-1 px-2">
                      <p className={cn('text-sm font-bold', isCorrect ? 'text-emerald-700' : 'text-rose-700')}>
                        {qIsEn ? 'Your answer: ' : 'إجابتك: '} {renderAnswer(q, given, qIsEn)}
                      </p>
                      {!isCorrect && (
                        <p className="text-sm font-black text-emerald-800 bg-emerald-100/70 px-3 py-1.5 rounded-xl w-fit">
                          {qIsEn ? 'Correct answer: ' : 'الإجابة الصحيحة: '} {renderAnswer(q, q.correct_answer, qIsEn)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => {
              if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
              }
              onFinish();
            }}
            className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-base transition-colors shadow-lg shadow-slate-200 cursor-pointer"
          >
            العودة لصفحة الاختبارات
          </button>
        </div>
      </AppLayout>
    );
  }

  return null;
}

function renderAnswer(q: ExamQuestion, value: string, isEn = false): string {
  if (!value || value.trim() === '') return isEn ? '(No answer)' : '(لم تتم الإجابة)';
  if (q.question_type === 'true_false') {
    if (isEn) {
      return value === 'true' ? 'True ✓' : value === 'false' ? 'False ✗' : '(No answer)';
    }
    return value === 'true' ? 'صح ✓' : value === 'false' ? 'خطأ ✗' : '(لم تتم الإجابة)';
  }
  return value;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-4">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-base font-black text-slate-900">{value}</p>
    </div>
  );
}
