import { z } from 'zod';
import type { QuestionType } from '@/hooks/queries/useElectronicExams';

export const examSchema = z.object({
  title:            z.string().min(1, 'العنوان مطلوب').max(200, 'الحد الأقصى 200 حرف'),
  subject:          z.string().min(1, 'المادة مطلوبة').max(100, 'الحد الأقصى 100 حرف'),
  duration_minutes: z.coerce.number().min(1, 'المدة لا تقل عن دقيقة').max(180, 'المدة لا تزيد عن 180 دقيقة'),
  available_until:  z.string().optional(),
  language:         z.enum(['ar', 'en']).default('ar'),
  instructions:     z.string().max(1000, 'الحد الأقصى 1000 حرف').optional(),
});

export type ExamFormData = z.infer<typeof examSchema>;

export interface LocalQuestion {
  id?: string; // DB UUID
  _key: string; // local unique id
  question_type: QuestionType;
  question_text: string;
  options: [string, string, string, string]; // MCQ only
  correct_answer: string;
}

export function makeKey() {
  return Math.random().toString(36).slice(2);
}

export function emptyQuestion(type: QuestionType = 'true_false'): LocalQuestion {
  return {
    _key: makeKey(),
    question_type: type,
    question_text: '',
    options: ['', '', '', ''],
    correct_answer: type === 'true_false' ? 'true' : '',
  };
}

export type WizardStep = 'info' | 'questions' | 'preview';
