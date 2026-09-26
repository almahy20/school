import React from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Send,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExamQuestion } from '@/hooks/queries/useElectronicExams';

interface ExamFooterActionsProps {
  currentQ: number;
  totalQuestions: number;
  questions: ExamQuestion[];
  answers: Record<string, string>;
  onNavigate: (idx: number) => void;
  onSubmitClick: () => void;
}

export function ExamFooterActions({
  currentQ,
  totalQuestions,
  questions,
  answers,
  onNavigate,
  onSubmitClick,
}: ExamFooterActionsProps) {
  const answeredCount = Object.keys(answers).filter(k => answers[k]?.trim() !== '').length;

  return (
    <div className="mt-8 space-y-6">
      <div className="flex items-center gap-3">
        {/* Previous Button (Right Side in RTL) */}
        <button
          onClick={() => onNavigate(Math.max(0, currentQ - 1))}
          disabled={currentQ === 0}
          className="flex-1 h-13 sm:h-14 rounded-2xl border-2 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-black text-sm sm:text-base disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          <ArrowRight className="w-5 h-5" />
          السابق
        </button>

        {/* Next / Finish Button (Left Side in RTL) */}
        {currentQ < totalQuestions - 1 ? (
          <button
            onClick={() => onNavigate(Math.min(totalQuestions - 1, currentQ + 1))}
            className="flex-[2] h-13 sm:h-14 rounded-2xl bg-violet-600 hover:bg-violet-700 active:scale-[0.99] text-white font-black text-sm sm:text-base transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-200 cursor-pointer"
          >
            السؤال التالي
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={onSubmitClick}
            className="flex-[2] h-13 sm:h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-sm sm:text-base transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 cursor-pointer"
          >
            <Send className="w-5 h-5" />
            إنهاء وتسليم الاختبار
          </button>
        )}
      </div>

      {/* Quick Question Jump Dots Navigator */}
      <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
            الانتقال السريع للأسئلة ({totalQuestions} سؤال)
          </p>
          {answeredCount === totalQuestions && totalQuestions > 0 && (
            <span className="text-emerald-600 font-black text-xs flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              أجبت على جميع الأسئلة
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {questions.map((question, i) => {
            const isCurrent = i === currentQ;
            const isDone = answers[question.id] !== undefined && answers[question.id]?.trim() !== '';

            return (
              <button
                key={question.id}
                onClick={() => onNavigate(i)}
                className={cn(
                  'w-10 h-10 sm:w-11 sm:h-11 rounded-2xl font-black text-xs sm:text-sm transition-all duration-200 flex items-center justify-center cursor-pointer',
                  isCurrent
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-200 ring-2 ring-violet-400 ring-offset-2 scale-105'
                    : isDone
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
