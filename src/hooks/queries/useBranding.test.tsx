import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHookWithClient } from '../../test/utils';
import { useBranding } from './useBranding';
import { supabase } from '@/integrations/supabase/client';
import { waitFor } from '@testing-library/react';

// إعداد بيئة آمنة للتجارب بدون ضرب خادم حقيقي
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn(() => mockChannel),
    removeChannel: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { schoolId: 'school-123' } })
}));

describe('School Branding Sync & Integrity Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChannel.on.mockClear();
    mockChannel.subscribe.mockClear();
  });

  it('يجب أن يجلب بيانات الهوية واللوجو للمنصة ويعرضها (Integration Test)', async () => {
    // تجهيز رد الخادم (Mock) بصورة وهمية واسم للمدرسة
    const mockSchoolData = { id: 'school-123', name: 'مدارس الأوائل', logo_url: 'https://fake-url.com/logo.png', slug: 'alawael' };
    
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: mockSchoolData, error: null });
    const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    (supabase.from as any).mockReturnValue({ select: mockSelect });

    const { result } = renderHookWithClient(() => useBranding());

    // نتحقق من مرحلة الجلب (Loading)
    expect(result.current.isLoading).toBe(true);

    // ننتظر حتى ينتهي الجلب بنجاح
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // نتأكد من انعكاس بيانات الهوية البصرية بنجاح
    expect(result.current.data?.name).toBe('مدارس الأوائل');
    expect(result.current.data?.logo_url).toContain('logo.png');
    
    // التحقق من أن الاستعلام استُدعي على جدول schools
    expect(supabase.from).toHaveBeenCalledWith('schools');
  });

  it('التأكد من التفعيل الصحيح لقناة التزامن الفوري (Real-time Sync Subscription)', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    (supabase.from as any).mockReturnValue({ select: mockSelect });

    renderHookWithClient(() => useBranding());

    // التحقق من إنشاء قناة باسم يحتوي على معرف المدرسة
    expect(supabase.channel).toHaveBeenCalledWith(expect.stringContaining('branding-school-123'));
    
    // التحقق من الاشتراك في التغييرات
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: '*',
        schema: 'public',
        table: 'schools',
        filter: 'id=eq.school-123',
      }),
      expect.any(Function)
    );
    expect(mockChannel.subscribe).toHaveBeenCalled();
  });

  it('التأكد من التكيف مع غياب اللوجو بشكل آمن (Edge Case)', async () => {
    const mockSchoolData = { id: 'school-123', name: 'مدارس بلا لوجو', logo_url: null, slug: 'no-logo' };
    
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: mockSchoolData, error: null });
    const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    (supabase.from as any).mockReturnValue({ select: mockSelect });

    const { result } = renderHookWithClient(() => useBranding());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // يجب ألا ينهار النظام إذا كان الـ URL يساوي null
    expect(result.current.data?.logo_url).toBeNull();
    expect(result.current.data?.name).toBe('مدارس بلا لوجو');
  });

  it('التعامل مع خطأ في الشبكة أثناء جلب الهوية (Error Handling)', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'Network Error', code: 'P001' } });
    const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    (supabase.from as any).mockReturnValue({ select: mockSelect });

    const { result } = renderHookWithClient(() => useBranding());

    await waitFor(() => {
      // بما أن fetchBranding يعيد null عند الخطأ
      expect(result.current.data).toBeNull();
    });
  });
});
