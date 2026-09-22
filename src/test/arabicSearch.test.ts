import { describe, it, expect } from 'vitest';
import {
  normalizeArabic,
  normalizeStudentName,
  stripSpaces,
  matchesArabic,
  buildArabicSearchPatterns,
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
});
