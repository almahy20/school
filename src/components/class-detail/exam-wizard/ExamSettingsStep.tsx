import React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { ExamFormData } from './types';

interface ExamSettingsStepProps {
  form: UseFormReturn<ExamFormData>;
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  isSubmitting: boolean;
}

export function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
      {children}
      {error && <p className="text-xs text-rose-500 font-bold">{error}</p>}
    </div>
  );
}

export default function ExamSettingsStep({ form, onSubmit, isSubmitting }: ExamSettingsStepProps) {
  const currentLanguage = form.watch('language');

  return (
    <div className="bg-white border border-slate-100 rounded-[28px] p-6 space-y-5">
      <h3 className="font-black text-slate-900">بيانات الاختبار</h3>
      <form onSubmit={onSubmit} className="space-y-4">
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
            disabled={isSubmitting}
            className="h-11 px-8 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black gap-2"
          >
            {isSubmitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</>
              : 'حفظ والمتابعة →'
            }
          </Button>
        </div>
      </form>
    </div>
  );
}
