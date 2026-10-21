import { useState, useMemo } from 'react';
import {
  Plus, Trash2, ArrowUp, ArrowDown, Eye, Send, Loader2,
  CheckCircle2, XCircle, Sparkles, X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { isEnglishText, type QuestionType } from '@/hooks/queries/useElectronicExams';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { LocalQuestion } from './types';

interface QuestionBuilderStepProps {
  questions: LocalQuestion[];
  examLanguage: 'ar' | 'en';
  isSaving: boolean;
  isPublishing: boolean;
  onUpdateQuestion: (idx: number, patch: Partial<LocalQuestion>) => void;
  onChangeType: (idx: number, type: QuestionType) => void;
  onMoveUp: (idx: number) => void;
  onMoveDown: (idx: number) => void;
  onRemoveQuestion: (idx: number) => void;
  onAddQuestion: () => void;
  onBackToInfo: () => void;
  onSaveQuestions: (andPublish?: boolean) => void;
}

export default function QuestionBuilderStep({
  questions,
  examLanguage,
  isSaving,
  isPublishing,
  onUpdateQuestion,
  onChangeType,
  onMoveUp,
  onMoveDown,
  onRemoveQuestion,
  onAddQuestion,
  onBackToInfo,
  onSaveQuestions,
}: QuestionBuilderStepProps) {
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);

  const confirmDelete = () => {
    if (deleteIdx !== null) {
      onRemoveQuestion(deleteIdx);
      setDeleteIdx(null);
    }
  };

  return (
    <div className="space-y-4">
      {questions.map((q, idx) => (
        <QuestionEditor
          key={q._key}
          index={idx}
          total={questions.length}
          question={q}
          examLanguage={examLanguage}
          onChange={patch => onUpdateQuestion(idx, patch)}
          onChangeType={type => onChangeType(idx, type)}
          onMoveUp={() => onMoveUp(idx)}
          onMoveDown={() => onMoveDown(idx)}
          onDelete={() => setDeleteIdx(idx)}
        />
      ))}

      {/* Add question */}
      {questions.length < 50 ? (
        <button
          onClick={onAddQuestion}
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
          onClick={onBackToInfo}
          className="flex-1 h-11 rounded-2xl border border-slate-200 text-slate-600 font-black text-sm hover:bg-slate-50 transition-colors"
        >
          ← السابق
        </button>
        <button
          onClick={() => onSaveQuestions(false)}
          disabled={isSaving || questions.length === 0}
          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-2xl bg-slate-100 text-slate-700 font-black text-sm hover:bg-slate-200 disabled:opacity-50 transition-colors"
        >
          {isSaving
            ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</>
            : <><Eye className="w-4 h-4" /> معاينة الاختبار</>
          }
        </button>
        <button
          onClick={() => onSaveQuestions(true)}
          disabled={isSaving || isPublishing || questions.length === 0}
          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-2xl bg-violet-600 text-white font-black text-sm hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {isPublishing
            ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري النشر...</>
            : <><Send className="w-4 h-4" /> نشر الاختبار</>
          }
        </button>
      </div>

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
              onClick={confirmDelete}
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

import { normalizeArabic } from '@/utils/arabicSearch';

export function isOptionSelectedAsCorrect(
  correctAnswer: string | undefined | null,
  opt: string,
  oi: number,
  letters: string[]
): boolean {
  if (!correctAnswer || !opt || opt.trim() === '') return false;
  const c = correctAnswer.trim();
  const o = opt.trim();

  // 1. مطابقة مباشرة
  if (c === o) return true;

  // 2. مطابقة بدون حساسية للأحرف
  if (c.toLowerCase() === o.toLowerCase()) return true;

  // 3. مطابقة بالتوحيد اللغوي العربي
  if (normalizeArabic(c) === normalizeArabic(o)) return true;

  // 4. مطابقة إذا كانت الإجابة الصحيحة مخزنة كفهرس (0, 1, 2, 3 أو 1, 2, 3, 4)
  if (c === String(oi) || c === String(oi + 1)) return true;

  // 5. مطابقة إذا كانت الإجابة الصحيحة مخزنة كحرف (أ، ب، ج، د أو A, B, C, D)
  if (c === letters[oi] || c.toLowerCase() === ['a', 'b', 'c', 'd'][oi]) return true;

  // 6. في حال كانت الإجابة مقسمة بـ /
  if (c.includes('/') || c.includes('،') || c.includes(',')) {
    const parts = c.split(new RegExp('[/,،|]')).map(p => p.trim());
    if (parts.some(p => p === o || normalizeArabic(p) === normalizeArabic(o))) return true;
  }

  return false;
}

// ─── Question Editor ──────────────────────────────────────────────────────────

export function QuestionEditor({
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
            {(['true', 'false'] as const).map(val => {
              const cur = (question.correct_answer || '').trim().toLowerCase();
              const isSelected = (
                cur === val ||
                (val === 'true' && (cur === 'صح' || cur === 'صواب' || cur === '1')) ||
                (val === 'false' && (cur === 'غلط' || cur === 'خطأ' || cur === '0'))
              );

              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => onChange({ correct_answer: val })}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 h-10 rounded-2xl text-sm font-black border-2 transition-all',
                    isSelected
                      ? val === 'true' ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-rose-50 border-rose-400 text-rose-700'
                      : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200'
                  )}
                >
                  {val === 'true' 
                    ? <><CheckCircle2 className="w-4 h-4" /> {isEn ? 'True' : 'صح'}</> 
                    : <><XCircle className="w-4 h-4" /> {isEn ? 'False' : 'غلط'}</>
                  }
                </button>
              );
            })}
          </div>
        </div>
      )}

      {question.question_type === 'multiple_choice' && (
        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {isEn ? 'Options (A, B, C, D) *' : 'الخيارات (أ، ب، ج، د) *'}
          </label>
          {question.options.map((opt, oi) => {
            const isCorrect = isOptionSelectedAsCorrect(question.correct_answer, opt, oi, letters);
            return (
              <div key={oi} dir={isEn ? 'ltr' : 'rtl'} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const cleanOpt = opt.trim();
                    if (cleanOpt) {
                      const newOpts = [...question.options];
                      newOpts[oi] = cleanOpt;
                      onChange({ options: newOpts, correct_answer: cleanOpt });
                    }
                  }}
                  className={cn(
                    'w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 border-2 transition-all',
                    isCorrect
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
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
                    const newOpts = [...question.options];
                    const oldVal = newOpts[oi];
                    newOpts[oi] = e.target.value;
                    const isThisCorrect = isOptionSelectedAsCorrect(question.correct_answer, oldVal, oi, letters);
                    const newCorrect = isThisCorrect ? e.target.value.trim() : question.correct_answer;
                    onChange({ options: newOpts, correct_answer: newCorrect });
                  }}
                  placeholder={isEn ? `Option ${letters[oi]}` : `الخيار ${letters[oi]}`}
                  maxLength={200}
                  className={cn(
                    "h-9 rounded-2xl text-sm flex-1 font-bold",
                    isCorrect ? "border-emerald-300 bg-emerald-50/20" : "",
                    isEn ? "text-left" : "text-right"
                  )}
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
        <FillBlankEditor
          question={question}
          isEn={isEn}
          onChange={onChange}
        />
      )}
    </div>
  );
}

function FillBlankEditor({
  question,
  isEn,
  onChange,
}: {
  question: LocalQuestion;
  isEn: boolean;
  onChange: (patch: Partial<LocalQuestion>) => void;
}) {
  const [altInput, setAltInput] = useState('');

  // استخراج الإجابة الأساسية والبدائل المتعددة
  const rawParts = useMemo(() => {
    const fromCorrect = (question.correct_answer || '')
      .split(new RegExp('[/,،|]'))
      .map(s => s.trim())
      .filter(Boolean);

    const fromOptions = (Array.isArray(question.options) ? question.options : [])
      .map(s => String(s).trim())
      .filter(Boolean);

    const primary = fromCorrect[0] || '';
    const extraAlts = new Set<string>();
    fromCorrect.slice(1).forEach(a => extraAlts.add(a));
    fromOptions.forEach(a => {
      if (a !== primary) extraAlts.add(a);
    });

    return {
      primary,
      alternatives: Array.from(extraAlts),
    };
  }, [question.correct_answer, question.options]);

  const handlePrimaryChange = (val: string) => {
    const newCorrect = [val.trim(), ...rawParts.alternatives].filter(Boolean).join(' / ');
    onChange({
      correct_answer: newCorrect,
      options: rawParts.alternatives,
    });
  };

  const handleAddAlt = () => {
    const trimmed = altInput.trim();
    if (!trimmed) return;
    if (trimmed === rawParts.primary || rawParts.alternatives.includes(trimmed)) {
      setAltInput('');
      return;
    }
    const newAlts = [...rawParts.alternatives, trimmed];
    const newCorrect = [rawParts.primary, ...newAlts].filter(Boolean).join(' / ');
    onChange({
      correct_answer: newCorrect,
      options: newAlts,
    });
    setAltInput('');
  };

  const handleRemoveAlt = (idxToRemove: number) => {
    const newAlts = rawParts.alternatives.filter((_, i) => i !== idxToRemove);
    const newCorrect = [rawParts.primary, ...newAlts].filter(Boolean).join(' / ');
    onChange({
      correct_answer: newCorrect,
      options: newAlts,
    });
  };

  return (
    <div className="space-y-3 pt-1">
      {/* Primary Answer */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
          <span>{isEn ? 'Primary Correct Answer *' : 'الإجابة النموذجية الأولى *'}</span>
          <span className="text-emerald-600 font-bold normal-case text-[10px]">
            {isEn ? 'Required' : 'مطلوبة'}
          </span>
        </label>
        <Input
          dir={isEn ? 'ltr' : 'rtl'}
          value={rawParts.primary}
          onChange={e => handlePrimaryChange(e.target.value)}
          placeholder={isEn ? 'e.g. Cairo' : 'مثال: القاهرة'}
          maxLength={200}
          className={cn("h-10 rounded-2xl bg-white border-slate-200 focus:border-violet-500 font-bold text-slate-800", isEn ? "text-left" : "text-right")}
        />
      </div>

      {/* Alternative Answers Input & Chips */}
      <div className="space-y-2 bg-slate-50 border border-slate-100 rounded-2xl p-3.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-black text-slate-700 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-violet-600" />
            <span>{isEn ? 'Alternative Accepted Answers (Optional)' : 'احتمالات وبدائل أخرى صحيحة (اختياري)'}</span>
          </label>
          <span className="text-[10px] font-bold text-slate-400">
            {rawParts.alternatives.length} {isEn ? 'alternatives' : 'احتمالات مسجلة'}
          </span>
        </div>

        <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
          {isEn
            ? 'Add any other acceptable phrasing (e.g. "Greater Cairo", "City of Cairo"). The system also automatically tolerates 1-letter typos and Arabic variations.'
            : 'أضف أي صياغة أخرى تعتبرها صحيحة (مثال: "مدينة القاهرة"، "القاهرة الكبرى"). النظام يتسامح تلقائياً أيضاً مع الهمزات وسقطات الكيبورد.'}
        </p>

        <div className="flex gap-2">
          <Input
            dir={isEn ? 'ltr' : 'rtl'}
            value={altInput}
            onChange={e => setAltInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddAlt();
              }
            }}
            placeholder={isEn ? 'Type alternative & press Enter or Add...' : 'اكتب احتمالاً بديلاً ثم اضغط إضافة أو Enter...'}
            maxLength={100}
            className={cn("h-9 rounded-xl bg-white text-xs font-bold", isEn ? "text-left" : "text-right")}
          />
          <button
            type="button"
            onClick={handleAddAlt}
            disabled={!altInput.trim()}
            className="px-3.5 h-9 rounded-xl bg-violet-600 hover:bg-violet-700 active:scale-95 disabled:opacity-40 text-white text-xs font-black shrink-0 transition-all cursor-pointer"
          >
            + {isEn ? 'Add' : 'إضافة'}
          </button>
        </div>

        {/* Alternatives Chips List */}
        {rawParts.alternatives.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {rawParts.alternatives.map((alt, ai) => (
              <span
                key={ai}
                className="inline-flex items-center gap-1.5 bg-white border border-violet-200 text-violet-700 px-2.5 py-1 rounded-xl text-xs font-black shadow-xs animate-in fade-in zoom-in-95 duration-150"
              >
                <span>{alt}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveAlt(ai)}
                  className="w-4 h-4 rounded-full flex items-center justify-center text-violet-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title={isEn ? 'Remove alternative' : 'حذف هذا الاحتمال'}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
