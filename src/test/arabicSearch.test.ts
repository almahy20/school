import { describe, it, expect } from 'vitest';
import {
  normalizeArabic,
  normalizeStudentName,
  stripSpaces,
  matchesArabic,
  buildArabicSearchPatterns,
  isExamAnswerCorrect,
} from '@/utils/arabicSearch';

describe('Arabic Search & Normalization Engine', () => {
  it('normalizes Alef and Hamza variations (أ, إ, آ, ٱ, ء)', () => {
    expect(normalizeArabic('أحمد')).toBe('احمد');
    expect(normalizeArabic('إبراهيم')).toBe('ابراهيم');
    expect(normalizeArabic('آلاء')).toBe('الاا');
  });

  it('normalizes Yaa, Alef Maqsura, and Nabrah (ي, ى, ئ, ی)', () => {
    expect(normalizeArabic('يمنى')).toBe('يمني');
    expect(normalizeArabic('علي')).toBe('علي');
    expect(normalizeArabic('على')).toBe('علي');
    expect(normalizeArabic('عائشة')).toBe('عايشه');
  });

  it('normalizes Taa Marbouta and Haa (ة, ه)', () => {
    expect(normalizeArabic('فاطمة')).toBe('فاطمه');
    expect(normalizeArabic('مدرسة')).toBe('مدرسه');
    expect(normalizeArabic('حمزة')).toBe('حمزه');
  });

  it('removes Tashkeel and Tatweel (ـ)', () => {
    expect(normalizeArabic('مُحَمَّدٌ')).toBe('محمد');
    expect(normalizeArabic('مـحـمـد')).toBe('محمد');
  });

  it('matches space-less compound names (عبدالرحمن <-> عبد الرحمن)', () => {
    expect(matchesArabic('عبد الرحمن سيد', 'عبدالرحمن')).toBe(true);
    expect(matchesArabic('عبدالرحمن سيد', 'عبد الرحمن')).toBe(true);
    expect(matchesArabic('عبد الله محمود', 'عبدالله')).toBe(true);
    expect(matchesArabic('عبدالله محمود', 'عبد الله')).toBe(true);
  });

  it('matches names when space is omitted by mistake (احمدسيد <-> احمد سيد)', () => {
    expect(matchesArabic('احمد سيد علي', 'احمدسيد')).toBe(true);
    expect(matchesArabic('احمدسيد علي', 'احمد سيد')).toBe(true);
  });

  it('matches multi-token queries regardless of middle names', () => {
    expect(matchesArabic('محمد سيد احمد فوزي', 'محمد احمد')).toBe(true);
    expect(matchesArabic('محمد سيد احمد فوزي', 'احمد محمد')).toBe(true);
  });

  it('generates rich search patterns for Supabase queries', () => {
    const patterns = buildArabicSearchPatterns('عبدالرحمن');
    expect(patterns).toContain('عبدالرحمن');
    expect(patterns).toContain('عبد الرحمن');

    const taaPatterns = buildArabicSearchPatterns('فاطمة');
    expect(taaPatterns).toContain('فاطمة');
    expect(taaPatterns).toContain('فاطمه');

    const yaaPatterns = buildArabicSearchPatterns('يمنى');
    expect(yaaPatterns).toContain('يمنى');
    expect(yaaPatterns).toContain('يمني');
  });

  describe('isExamAnswerCorrect (Fill-in-the-blank Arabic tolerance)', () => {
    it('accepts Taa Marbouta vs Haa (ة vs ه)', () => {
      expect(isExamAnswerCorrect('مدرسه', 'مدرسة', 'fill_blank')).toBe(true);
      expect(isExamAnswerCorrect('مدرسة', 'مدرسه', 'fill_blank')).toBe(true);
      expect(isExamAnswerCorrect('القاهره', 'القاهرة', 'fill_blank')).toBe(true);
    });

    it('accepts Yaa vs Alef Maqsura (ي vs ى)', () => {
      expect(isExamAnswerCorrect('علي', 'على', 'fill_blank')).toBe(true);
      expect(isExamAnswerCorrect('على', 'علي', 'fill_blank')).toBe(true);
      expect(isExamAnswerCorrect('مصطفى', 'مصطفي', 'fill_blank')).toBe(true);
      expect(isExamAnswerCorrect('مصطفي', 'مصطفى', 'fill_blank')).toBe(true);
    });

    it('accepts Alef variations and Hamzas (أ, إ, آ, ا)', () => {
      expect(isExamAnswerCorrect('أحمد', 'احمد', 'fill_blank')).toBe(true);
      expect(isExamAnswerCorrect('احمد', 'أحمد', 'fill_blank')).toBe(true);
      expect(isExamAnswerCorrect('إسلام', 'اسلام', 'fill_blank')).toBe(true);
      expect(isExamAnswerCorrect('القران', 'القرآن', 'fill_blank')).toBe(true);
    });

    it('ignores diacritics / Tashkeel & Tatweel', () => {
      expect(isExamAnswerCorrect('مَدْرَسَةٌ', 'مدرسه', 'fill_blank')).toBe(true);
      expect(isExamAnswerCorrect('مـحـمـد', 'محمد', 'fill_blank')).toBe(true);
    });

    it('handles spacing in compound words', () => {
      expect(isExamAnswerCorrect('عبدالرحمن', 'عبد الرحمن', 'fill_blank')).toBe(true);
      expect(isExamAnswerCorrect('عبد الرحمن', 'عبدالرحمن', 'fill_blank')).toBe(true);
    });

    it('accepts Arabic-Indic numerals vs English digits (0-9 vs ٠-٩)', () => {
      expect(isExamAnswerCorrect('1973', '١٩٧٣', 'fill_blank')).toBe(true);
      expect(isExamAnswerCorrect('١٩٧٣', '1973', 'fill_blank')).toBe(true);
      expect(isExamAnswerCorrect('سنة 1952', 'سنه ١٩٥٢', 'fill_blank')).toBe(true);
      expect(isExamAnswerCorrect('4', '٤', 'fill_blank')).toBe(true);
      expect(isExamAnswerCorrect('15', '١٥', 'fill_blank')).toBe(true);
      expect(isExamAnswerCorrect('50', '۵۰', 'fill_blank')).toBe(true);
      expect(isExamAnswerCorrect('٤', '4', 'multiple_choice')).toBe(true);
    });

    it('supports alternative answers separated by slash or comma', () => {
      expect(isExamAnswerCorrect('القاهرة', 'القاهرة / القاهرة الكبرى', 'fill_blank')).toBe(true);
      expect(isExamAnswerCorrect('القاهره الكبرى', 'القاهرة / القاهرة الكبرى', 'fill_blank')).toBe(true);
      expect(isExamAnswerCorrect('مصر', 'جمهورية مصر العربية ، مصر', 'fill_blank')).toBe(true);
    });

    it('rejects actual wrong answers', () => {
      expect(isExamAnswerCorrect('الإسكندرية', 'القاهرة', 'fill_blank')).toBe(false);
      expect(isExamAnswerCorrect('', 'القاهرة', 'fill_blank')).toBe(false);
    });
  });
});
