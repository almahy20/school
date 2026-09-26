import React from 'react';
import {
  CheckCircle2,
  XCircle,
  Check,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { isEnglishText, type ExamQuestion } from '@/hooks/queries/useElectronicExams';

interface QuestionCardProps {
  question: ExamQuestion;
  questionIndex: number;
  answer: string;
  onAnswerChange: (value: string) => void;
  isEnglishExam?: boolean;
}

const questionTypeLabels: Record<string, string> = {
  true_false: 'صح أو خطأ',
  multiple_choice: 'اختيار من متعدد',
  fill_blank: 'إكمال الفراغ',
};

export function QuestionCard({
  question,
  questionIndex,
  answer,
  onAnswerChange,
  isEnglishExam = false,
}: QuestionCardProps) {
  const isEn = isEnglishExam || isEnglishText(question.question_text);
  const letters = isEn ? ['A', 'B', 'C', 'D'] : ['أ', 'ب', 'ج', 'د'];
  const typeLabel = isEn
    ? (question.question_type === 'true_false' ? 'True / False' : question.question_type === 'multiple_choice' ? 'Multiple Choice' : 'Fill in Blank')
    : (questionTypeLabels[question.question_type] || 'سؤال');

  const isAnswered = answer !== undefined && answer.trim() !== '';

  return (
    <div className="bg-white border border-slate-100 rounded-[32px] p-6 sm:p-8 space-y-7 shadow-xl shadow-slate-100/60">
      {/* Question Header & Badges */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <Badge className="bg-violet-600 text-white font-black text-xs px-3 py-1 rounded-xl">
            {isEn ? `Question ${questionIndex + 1}` : `السؤال ${questionIndex + 1}`}
          </Badge>
          <Badge variant="outline" className="border-slate-200 text-slate-500 font-bold text-xs px-3 py-1 rounded-xl">
            {typeLabel}
          </Badge>
        </div>

        {isAnswered ? (
          <span className="flex items-center gap-1 text-emerald-600 text-xs font-black bg-emerald-50 px-2.5 py-1 rounded-lg">
            <Check className="w-3.5 h-3.5" />
            {isEn ? 'Answered' : 'تمت الإجابة'}
          </span>
        ) : (
          <span className="text-slate-400 text-xs font-bold bg-slate-50 px-2.5 py-1 rounded-lg">
            {isEn ? 'Not answered yet' : 'لم تتم الإجابة بعد'}
          </span>
        )}
      </div>

      {/* Question Text */}
      <div className="py-2" dir={isEn ? 'ltr' : 'rtl'}>
        <h2
          className={cn(
            'text-xl sm:text-2xl md:text-3xl font-black text-slate-900 leading-relaxed md:leading-loose whitespace-pre-wrap select-text tracking-normal',
            isEn ? 'text-left font-sans' : 'text-right'
          )}
        >
          {question.question_text}
        </h2>
      </div>

      {/* Answers Form Controls */}
      {question.question_type === 'true_false' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {(['true', 'false'] as const).map(val => {
            const isSelected = answer === val;
            const isTrue = val === 'true';
            return (
              <button
                key={val}
                type="button"
                onClick={() => onAnswerChange(val)}
                className={cn(
                  // ⚠️ SECURITY: Both options use the SAME neutral/violet color.
                  // Never use green=correct or red=wrong during the exam itself,
                  // as this would visually reveal the correct answer to the student.
                  // Correct/wrong colors are only shown in the result screen AFTER submission.
                  'flex items-center justify-center gap-3 h-16 sm:h-20 rounded-2xl text-lg sm:text-xl font-black border-2 transition-all duration-200 cursor-pointer',
                  isSelected
                    ? 'bg-violet-600 border-violet-600 text-white shadow-lg shadow-violet-200 scale-[1.02]'
                    : 'bg-slate-50 border-slate-200/90 text-slate-700 hover:border-violet-300 hover:bg-violet-50/40'
                )}
              >
                {isTrue ? (
                  <>
                    <CheckCircle2 className="w-6 h-6" />
                    <span>{isEn ? 'True' : 'صح'}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-6 h-6" />
                    <span>{isEn ? 'False' : 'خطأ'}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}

      {question.question_type === 'multiple_choice' && (
        <div dir={isEn ? 'ltr' : 'rtl'} className="space-y-3.5 pt-2">
          {(question.options as string[]).map((opt, oi) => {
            const isSelected = answer === opt;
            return (
              <button
                key={oi}
                type="button"
                onClick={() => onAnswerChange(opt)}
                className={cn(
                  'w-full flex items-center gap-4 p-4 sm:p-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer group',
                  isEn ? 'text-left' : 'text-right',
                  isSelected
                    ? 'bg-violet-50 border-violet-600 text-violet-950 shadow-md shadow-violet-100 scale-[1.01]'
                    : 'bg-slate-50/70 border-slate-200/80 text-slate-800 hover:border-violet-300 hover:bg-violet-50/30'
                )}
              >
                <span
                  className={cn(
                    'w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center text-sm sm:text-base font-black shrink-0 border-2 transition-colors',
                    isSelected
                      ? 'bg-violet-600 border-violet-600 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 group-hover:border-violet-300 group-hover:text-violet-600'
                  )}
                >
                  {letters[oi]}
                </span>
                <span className={cn('text-base sm:text-lg font-bold flex-1 leading-relaxed', isEn ? 'text-left font-sans' : 'text-right')}>
                  {opt}
                </span>
                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {question.question_type === 'fill_blank' && (
        <div dir={isEn ? 'ltr' : 'rtl'} className="space-y-3 pt-2">
          <label className={cn('text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2', isEn ? 'text-left' : 'text-right')}>
            <HelpCircle className="w-4 h-4 text-violet-500" />
            {isEn ? 'Type your exact answer here:' : 'اكتب إجابتك هنا بدقة:'}
          </label>
          <input
            dir={isEn ? 'ltr' : 'rtl'}
            value={answer || ''}
            onChange={e => onAnswerChange(e.target.value)}
            placeholder={isEn ? 'Write answer here...' : 'اكتب الإجابة هنا...'}
            className={cn(
              'w-full h-14 sm:h-16 rounded-2xl border-2 border-slate-200 bg-slate-50 focus:bg-white focus:border-violet-500 px-5 text-base sm:text-lg font-bold outline-none transition-all shadow-inner',
              isEn ? 'text-left font-sans' : 'text-right'
            )}
            autoFocus
          />
        </div>
      )}
    </div>
  );
}
