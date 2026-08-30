import { useState, useMemo, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import {
  ArrowRight, ArrowLeft, CheckCircle2, XCircle,
  Sparkles, BookOpen, Eye, Check, Brain, Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  useExamQuestions,
  isEnglishText,
  type ElectronicExam,
  type ExamQuestion,
  type ExamAttempt,
} from '@/hooks/queries/useElectronicExams';

interface ExamReviewViewProps {
  exam: ElectronicExam & {
    student_id: string;
    student_name: string;
    attempt?: ExamAttempt | null;
  };
  onBack: () => void;
}

type ReviewTab = 'flashcards' | 'mistakes_only' | 'full_list';

export default function ExamReviewView({ exam, onBack }: ExamReviewViewProps) {
  const { data: questions = [], isLoading } = useExamQuestions(exam.id);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [masteredMap, setMasteredMap] = useState<Record<string, boolean>>({});

  const userAnswers: Record<string, string> = useMemo(() => {
    return exam.attempt?.answers || {};
  }, [exam.attempt]);

  // Identify wrong questions for "Mistake Mastery" mode
  const wrongQuestions = useMemo(() => {
    return questions.filter(q => {
      const given = (userAnswers[q.id] || '').trim().toLowerCase();
      const correct = q.correct_answer.trim().toLowerCase();
      return given !== correct;
    });
  }, [questions, userAnswers]);

  // Default to mistakes_only if there are wrong answers, otherwise flashcards
  const [tab, setTab] = useState<ReviewTab>(() => {
    // initialize based on wrong answers if available
    return 'mistakes_only';
  });

  // Sync tab if wrongQuestions is calculated after questions load
  useEffect(() => {
    if (wrongQuestions.length > 0) {
      setTab('mistakes_only');
    } else {
      setTab('flashcards');
    }
  }, [wrongQuestions.length]);

  // Active question list depending on tab
  const activeList = tab === 'mistakes_only' ? wrongQuestions : questions;
  const currentQ = activeList[currentIdx];

  const handleNext = () => {
    if (currentIdx < activeList.length - 1) {
      setCurrentIdx(p => p + 1);
      setIsRevealed(false);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(p => p - 1);
      setIsRevealed(false);
    }
  };

  const toggleMastered = (qId: string) => {
    setMasteredMap(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  const score = exam.attempt?.score || 0;
  const totalScore = exam.attempt?.total_score || questions.length || 1;
  const pct = Math.round((score / totalScore) * 100);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-[850px] mx-auto py-16 px-4 text-center">
          <div className="w-12 h-12 rounded-full border-4 border-violet-500 border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-sm font-black text-slate-600">جاري تحميل أسئلة الاختبار للمراجعة...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-[850px] mx-auto px-4 md:px-0 pb-24 pt-4 animate-in fade-in duration-300" dir="rtl">
        
        {/* Top Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-black text-slate-500 hover:text-slate-900 transition-colors group cursor-pointer"
          >
            <ArrowRight className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            العودة للاختبارات
          </button>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-white border-slate-200 text-slate-700 font-black px-3 py-1 text-xs">
              👨‍👦 جلسة مراجعة مع: <span className="text-violet-600 mr-1">{exam.student_name}</span>
            </Badge>
          </div>
        </div>

        {/* Exam Title & Stats Banner */}
        <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-700 rounded-[32px] p-6 sm:p-8 text-white shadow-xl shadow-violet-200 mb-6 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black">{exam.title}</h1>
                <Badge className="bg-white/20 text-white hover:bg-white/30 border-none font-bold text-xs">
                  {exam.subject}
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-violet-100 font-bold">
                نتيجة الاختبار السابق: <span className="font-black text-white">{score} من {totalScore} ({pct}%)</span>
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-white/15 backdrop-blur-md rounded-2xl px-4 py-2.5 text-center border border-white/20">
                <p className="text-xs font-bold text-violet-200">الأسئلة الصحيحة</p>
                <p className="text-lg font-black text-emerald-300">{totalScore - wrongQuestions.length} ✅</p>
              </div>
              <div className="bg-white/15 backdrop-blur-md rounded-2xl px-4 py-2.5 text-center border border-white/20">
                <p className="text-xs font-bold text-violet-200">تحتاج مراجعة</p>
                <p className="text-lg font-black text-rose-300">{wrongQuestions.length} ❌</p>
              </div>
            </div>
          </div>
        </div>

        {/* Mode Switcher Tabs — Mistakes Challenge First */}
        <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-2xl mb-6">
          <button
            onClick={() => { setTab('mistakes_only'); setCurrentIdx(0); setIsRevealed(false); }}
            disabled={wrongQuestions.length === 0}
            className={cn(
              "flex items-center justify-center gap-2 py-3 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
              tab === 'mistakes_only'
                ? "bg-white text-rose-600 shadow-sm ring-1 ring-rose-200"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Target className="w-4 h-4 text-rose-500" />
            <span>تحدي الأخطاء ({wrongQuestions.length})</span>
          </button>

          <button
            onClick={() => { setTab('flashcards'); setCurrentIdx(0); setIsRevealed(false); }}
            className={cn(
              "flex items-center justify-center gap-2 py-3 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer",
              tab === 'flashcards'
                ? "bg-white text-violet-700 shadow-sm ring-1 ring-violet-200"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Brain className="w-4 h-4 text-violet-600" />
            <span>كروت المذاكرة الذكية</span>
          </button>

          <button
            onClick={() => { setTab('full_list'); }}
            className={cn(
              "flex items-center justify-center gap-2 py-3 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer",
              tab === 'full_list'
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <BookOpen className="w-4 h-4 text-slate-600" />
            <span>كشف الإجابات الكامل</span>
          </button>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            MODE 1 & 2: Flashcards / Mistake Mastery Interactive Card
        ────────────────────────────────────────────────────────────── */}
        {(tab === 'flashcards' || tab === 'mistakes_only') && (
          <div>
            {activeList.length === 0 ? (
              <div className="bg-white border border-emerald-100 rounded-[32px] p-10 text-center space-y-4 shadow-sm">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto text-3xl">
                  🎉
                </div>
                <h3 className="text-xl font-black text-slate-900">ما شاء الله! لا توجد أي أخطاء في هذا الاختبار</h3>
                <p className="text-sm font-bold text-slate-500">
                  لقد أجاب ابنك على جميع الأسئلة بشكل صحيح 100%. يمكنك مراجعة كروت المذاكرة لتثبيت المفاهيم.
                </p>
                <button
                  onClick={() => setTab('flashcards')}
                  className="px-6 py-2.5 rounded-xl bg-violet-600 text-white font-black text-xs hover:bg-violet-700 transition-colors"
                >
                  استعراض جميع الكروت
                </button>
              </div>
            ) : currentQ ? (
              <div className="space-y-6">
                
                {/* Parent Pedagogical Tip */}
                <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3">
                  <span className="text-lg">💡</span>
                  <div className="flex-1 text-xs sm:text-sm font-bold text-amber-900 leading-relaxed">
                    <span className="font-black text-amber-950">نصيحة لولي الأمر:</span> اطلب من ابنك أن يفكر ويجيبك شفهياً أولاً ويشرح لك سبب اختياره، ثم اضغط على زر <span className="font-black underline">كشف الحل النموذجي</span> لتأكيد المعلومة معاً.
                  </div>
                </div>

                {/* Main Interactive Flashcard */}
                {(() => {
                  const q = currentQ;
                  const given = userAnswers[q.id] || '';
                  const isOriginallyCorrect = given.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
                  const isEn = exam.language === 'en' || isEnglishText(q.question_text);
                  const isMastered = !!masteredMap[q.id];

                  return (
                    <div className={cn(
                      "bg-white border rounded-[36px] p-6 sm:p-10 shadow-xl transition-all space-y-7 relative overflow-hidden",
                      isMastered ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-100"
                    )}>
                      
                      {/* Card Top Meta */}
                      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-slate-900 text-white font-black text-xs px-3 py-1 rounded-xl">
                            سؤال {currentIdx + 1} من {activeList.length}
                          </Badge>
                          <Badge variant="outline" className="border-slate-200 text-slate-500 font-bold text-xs rounded-xl">
                            {q.question_type === 'true_false' ? 'صح أو خطأ' : q.question_type === 'multiple_choice' ? 'اختيار من متعدد' : 'أكمل الفراغ'}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-xs font-black px-3 py-1 rounded-xl flex items-center gap-1",
                            isOriginallyCorrect
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          )}>
                            {isOriginallyCorrect ? '✅ حله صحيحاً في الاختبار' : '❌ أخطأ فيه في الاختبار'}
                          </span>
                        </div>
                      </div>

                      {/* Question Text */}
                      <div className="py-2" dir={isEn ? 'ltr' : 'rtl'}>
                        <h2 className={cn(
                          "text-xl sm:text-2xl md:text-3xl font-black text-slate-900 leading-relaxed md:leading-loose whitespace-pre-wrap select-none",
                          isEn ? "text-left font-sans" : "text-right"
                        )}>
                          {q.question_text}
                        </h2>
                      </div>

                      {/* Interactive Choices (for multiple choice) */}
                      {q.question_type === 'multiple_choice' && (
                        <div dir={isEn ? 'ltr' : 'rtl'} className="space-y-3 pt-2">
                          {(q.options as string[]).map((opt, oi) => {
                            const isStudentPick = given === opt;
                            const isCorrectOpt = opt.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();

                            return (
                              <div
                                key={oi}
                                className={cn(
                                  "w-full flex items-center gap-4 p-4 sm:p-5 rounded-2xl border-2 transition-all select-none",
                                  isRevealed
                                    ? isCorrectOpt
                                      ? "bg-emerald-50/90 border-emerald-500 text-emerald-950 font-black shadow-md shadow-emerald-100"
                                      : isStudentPick
                                        ? "bg-rose-50 border-rose-300 text-rose-900 opacity-80"
                                        : "bg-slate-50/60 border-slate-200 text-slate-400 opacity-60"
                                    : "bg-slate-50/80 border-slate-200/90 text-slate-800"
                                )}
                              >
                                <span className={cn(
                                  "w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black shrink-0 border-2",
                                  isRevealed && isCorrectOpt
                                    ? "bg-emerald-500 border-emerald-500 text-white"
                                    : "bg-white border-slate-200 text-slate-600"
                                )}>
                                  {oi + 1}
                                </span>
                                <span className="text-base sm:text-lg font-bold flex-1 leading-relaxed">
                                  {opt}
                                </span>
                                {isRevealed && isCorrectOpt && (
                                  <Badge className="bg-emerald-600 text-white font-black text-xs px-2.5 py-1">
                                    الإجابة الصحيحة ✓
                                  </Badge>
                                )}
                                {isRevealed && isStudentPick && !isCorrectOpt && (
                                  <Badge className="bg-rose-500 text-white font-black text-xs px-2.5 py-1">
                                    إجابة الابن السابقة ✗
                                  </Badge>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* True/False Question Display */}
                      {q.question_type === 'true_false' && (
                        <div className="grid grid-cols-2 gap-4 pt-2">
                          {(['true', 'false'] as const).map(val => {
                            const isTrue = val === 'true';
                            const isCorrectOpt = val === q.correct_answer;
                            const isStudentPick = given === val;

                            return (
                              <div
                                key={val}
                                className={cn(
                                  "flex items-center justify-center gap-3 h-16 sm:h-20 rounded-2xl text-lg font-black border-2 transition-all select-none",
                                  isRevealed
                                    ? isCorrectOpt
                                      ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100"
                                      : isStudentPick
                                        ? "bg-rose-100 border-rose-300 text-rose-700 opacity-80"
                                        : "bg-slate-50 border-slate-200 text-slate-400 opacity-50"
                                    : "bg-slate-50 border-slate-200 text-slate-700"
                                )}
                              >
                                <span>{isTrue ? 'صح ✓' : 'خطأ ✗'}</span>
                                {isRevealed && isCorrectOpt && <Check className="w-5 h-5" />}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Revealed Detailed Explanation Card */}
                      {isRevealed ? (
                        <div className="bg-slate-50 border-2 border-dashed border-violet-200 rounded-3xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-violet-700 font-black text-sm">
                              <Sparkles className="w-4 h-4" />
                              <span>الحل النموذجي المعتمد:</span>
                            </div>
                            <span className="text-emerald-700 font-black text-sm bg-emerald-100 px-3 py-1 rounded-xl">
                              {renderAnswer(q, q.correct_answer, isEn)}
                            </span>
                          </div>

                          <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between flex-wrap gap-3">
                            <p className="text-xs font-bold text-slate-500">
                              إجابة الطالب في الاختبار: <span className={cn("font-black", isOriginallyCorrect ? "text-emerald-600" : "text-rose-600")}>
                                {renderAnswer(q, given, isEn)}
                              </span>
                            </p>

                            <button
                              onClick={() => toggleMastered(q.id)}
                              className={cn(
                                "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer",
                                isMastered
                                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                                  : "bg-white border border-slate-200 text-slate-700 hover:border-emerald-400"
                              )}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {isMastered ? 'تم إتقانها بنجاح 🌟' : 'تحديد كـ "تم إتقانها" 👍'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setIsRevealed(true)}
                          className="w-full h-14 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-black text-base flex items-center justify-center gap-2.5 shadow-lg shadow-violet-200 transition-all cursor-pointer"
                        >
                          <Eye className="w-5 h-5" />
                          اكشف الإجابة والحل النموذجي 💡
                        </button>
                      )}

                      {/* Navigation Controls */}
                      <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                        <button
                          onClick={handlePrev}
                          disabled={currentIdx === 0}
                          className="flex-1 h-12 rounded-2xl border-2 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-black text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <ArrowRight className="w-4 h-4" />
                          السابق
                        </button>

                        <button
                          onClick={handleNext}
                          disabled={currentIdx === activeList.length - 1}
                          className="flex-[2] h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                        >
                          التالي
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                      </div>

                    </div>
                  );
                })()}

                {/* Quick Question Jump Dots */}
                <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center mb-3">
                    الانتقال السريع لكروت المراجعة
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {activeList.map((question, i) => {
                      const isCurrent = i === currentIdx;
                      const isGivenCorrect = (userAnswers[question.id] || '').trim().toLowerCase() === question.correct_answer.trim().toLowerCase();
                      const isMastered = !!masteredMap[question.id];

                      return (
                        <button
                          key={question.id}
                          onClick={() => { setCurrentIdx(i); setIsRevealed(false); }}
                          className={cn(
                            'w-9 h-9 sm:w-10 sm:h-10 rounded-2xl font-black text-xs transition-all duration-200 flex items-center justify-center cursor-pointer',
                            isCurrent
                              ? 'bg-violet-600 text-white shadow-md shadow-violet-200 ring-2 ring-violet-400 ring-offset-2 scale-105'
                              : isMastered
                                ? 'bg-emerald-500 text-white'
                                : isGivenCorrect
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-rose-100 text-rose-800 border border-rose-200'
                          )}
                        >
                          {i + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>
            ) : null}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            MODE 3: Full Detailed Correction List
        ────────────────────────────────────────────────────────────── */}
        {tab === 'full_list' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
              <h3 className="font-black text-slate-900 text-base mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-violet-600" />
                جميع أسئلة الاختبار ({questions.length} سؤال)
              </h3>

              <div className="space-y-4">
                {questions.map((q, i) => {
                  const given = userAnswers[q.id] || '';
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
                        <p className={cn("text-base font-black text-slate-900 leading-relaxed flex-1 select-none", qIsEn ? "text-left font-sans" : "text-right")}>
                          <span className="text-slate-400 font-mono mx-1.5">#{i + 1}</span>
                          {q.question_text}
                        </p>
                      </div>

                      <div dir={qIsEn ? 'ltr' : 'rtl'} className="space-y-1.5 pt-1 px-2">
                        <p className={cn('text-sm font-bold', isCorrect ? 'text-emerald-700' : 'text-rose-700')}>
                          {qIsEn ? 'Student answer: ' : 'إجابة الطالب: '} {renderAnswer(q, given, qIsEn)}
                        </p>
                        {!isCorrect && (
                          <p className="text-sm font-black text-emerald-800 bg-emerald-100/70 px-3 py-1.5 rounded-xl w-fit">
                            {qIsEn ? 'Correct answer: ' : 'الإجابة النموذجية الصحيحة: '} {renderAnswer(q, q.correct_answer, qIsEn)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
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
