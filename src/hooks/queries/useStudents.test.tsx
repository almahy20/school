import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHookWithClient } from '../../test/utils';
import { useStudent } from './useStudents';
import { supabase } from '@/integrations/supabase/client';
import { waitFor } from '@testing-library/react';

// تزييف الخادم بالكامل حتى لا نتصل بقاعدة بيانات حقيقية
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('useStudent (Integration Test)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('يجب أن يعيد null بسلام متفادياً خطأ 406 Not Acceptable إذا كان الطالب غير موجود أو تم حذفه', async () => {
    // نحاكي رد الخادم عند عدم وجود السجل
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    
    (supabase.from as any).mockReturnValue({ select: mockSelect });

    const { result } = renderHookWithClient(() => useStudent('non-existent-student-id'));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // نتأكد أن الواجهة لم تنهار وحصلت على قيمة null
    expect(result.current.data).toBeNull();
    expect(supabase.from).toHaveBeenCalledWith('students');
  });

  it('يجب أن يجمع بيانات الطالب مع اسم المعلم بسلاسة إذا كان الطالب موجوداً', async () => {
    const mockStudent = { id: 'student-1', name: 'أحمد محمود', classes: { teacher_id: 'teacher-1' } };
    
    // المرة الأولى جلب الطالب، المرة الثانية جلب المدرس
    const mockMaybeSingle = vi.fn()
      .mockResolvedValueOnce({ data: mockStudent, error: null }) // محاكاة الطالب
      .mockResolvedValueOnce({ data: { full_name: 'الأستاذ حسن العطاس' }, error: null }); // محاكاة المدرس

    const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    (supabase.from as any).mockReturnValue({ select: mockSelect });

    const { result } = renderHookWithClient(() => useStudent('student-1'));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // يجب أن تكون البيانات مجمعة ومترابطة
    expect(result.current.data?.name).toBe('أحمد محمود');
    expect(result.current.data?.classes.teacher.full_name).toBe('الأستاذ حسن العطاس');
    
    // السيرفر انطلب مرتين (مرة للطالب ومرة للمعلم)
    expect(supabase.from).toHaveBeenCalledTimes(2);
  });
});
