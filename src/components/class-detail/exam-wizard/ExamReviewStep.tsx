import { Eye, Send, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { isEnglishText } from '@/hooks/queries/useElectronicExams';
import type { LocalQuestion } from './types';

interface ExamReviewStepProps {
  questions: LocalQuestion[];
  examLanguage: 'ar' | 'en';
  isPublishing: boolean;
  onBackToQuestions: () => void;
  onPublish: () => void;
}

export default function ExamReviewStep({
  questions,
  examLanguage,
  isPublishing,
  onBackToQuestions,
  onPublish,
}: ExamReviewStepProps) {
  return (
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
            <PreviewQuestion key={q._key} index={idx} question={q} examLanguage={examLanguage} />
          ))}
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onBackToQuestions}
          className="flex-1 h-11 rounded-2xl border border-slate-200 text-slate-600 font-black text-sm hover:bg-slate-50 transition-colors"
        >
          إغلاق المعاينة / تعديل
        </button>
        <button
          onClick={onPublish}
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
  );
}

// ─── Preview Question ──────────────────────────────────────────────────────────

export function PreviewQuestion({
  index,
  question,
  examLanguage,
}: {
  index: number;
  question: LocalQuestion;
  examLanguage: 'ar' | 'en';
}) {
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
