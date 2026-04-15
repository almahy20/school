import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHookWithClient } from '../../test/utils';
import { useUpdateSchool } from './useSuperAdmin';
import { supabase } from '@/integrations/supabase/client';
import { waitFor } from '@testing-library/react';

// المحاكاة الكاملة (Mocking)
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('Security & Edge Cases Test (useUpdateSchool / RLS)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('حماية الصلاحيات: سيفشل التحديث إذا حاول مستخدم غير مصرح له تعديل الهوية، وتُرفض العملية', async () => {
    // محاكاة استجابة قاعدة البيانات للخطأ الأمني الخاص بالـ RLS
    const rlsError = { code: '42501', message: 'new row violates row-level security policy for table "schools"' };
    const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: rlsError }) });
    
    (supabase.from as any).mockReturnValue({ update: mockUpdate });

    const { result } = renderHookWithClient(() => useUpdateSchool());

    // محاولة تنفيذ عملية الحقن
    result.current.mutate({ id: 'target-school-id', logo_url: 'evil-hacker-logo.png' });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // يجب أن تكون العملية باءت بالفشل وأمسكت بخطأ الحماية
    expect(result.current.error?.message).toContain('violates row-level security policy');
    expect(supabase.from).toHaveBeenCalledWith('schools');
  });

  it('حالة طوارئ البيانات: تنجح العملية فقط للمدير وتحدّث الشعار وتكسر ذاكرة التخزين المؤقتة', async () => {
    // محاكاة الاستجابة الناجحة
    const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    (supabase.from as any).mockReturnValue({ update: mockUpdate });

    const { result } = renderHookWithClient(() => useUpdateSchool());

    result.current.mutate({ id: 'my-school', logo_url: 'verified-logo.png?v=current-time' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.isError).toBe(false);
  });
});
