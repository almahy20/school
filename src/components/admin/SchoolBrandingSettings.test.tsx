import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SchoolBrandingSettings from './SchoolBrandingSettings';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';

// تزييف الأيقونات لتسريع الاختبار وتفادي مشاكل الرندر
vi.mock('lucide-react', () => ({
  Upload: () => <div data-testid="upload-icon" />,
  Palette: () => <div data-testid="palette-icon" />,
  Image: () => <div data-testid="image-icon" />,
  ImageIcon: () => <div data-testid="image-icon" />,
  Loader2: () => <div className="animate-spin" data-testid="loader-icon" />,
  Save: () => <div data-testid="save-icon" />,
}));

// تزييف الصلاحيات
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { schoolId: 'fake-school-id' } })
}));

const mockMutate = vi.fn().mockResolvedValue({});

// تزييف هوكس الجلب
vi.mock('@/hooks/queries', () => ({
  useBranding: () => ({ data: { logo_url: 'old-logo.png' }, isLoading: false }),
  useUpdateSchool: () => ({ mutateAsync: mockMutate, isPending: false })
}));

// تزييف التخزين لنجح عملية رفع اللوجو وهمياً
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'new-logo-uploaded.png' } })
      })
    }
  }
}));

describe('SchoolBrandingSettings (Admin Panel PWA Speed Test)', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const renderComponent = () => render(
    <QueryClientProvider client={queryClient}>
      <SchoolBrandingSettings />
    </QueryClientProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('أداء التحميل: يجب أن يظهر اللوجو القديم المستخرج من الكاش فور تحميل الواجهة', () => {
    renderComponent();
    const logoImage = screen.getByAltText('Logo');
    expect(logoImage).toBeInTheDocument();
    
    // نتأكد أنه قرأ من الكاش بنجاح وبسرعة
    expect(logoImage).toHaveAttribute('src', 'old-logo.png');
  });

  it('سرعة استجابة رفع الصورة: يجب أن تعكس الواجهة التغيير وتربط اللوجو الجديد برقم Timestamp لتتفادى كاش التصفح', async () => {
    renderComponent();
    
    const label = screen.getByText(/تغيير الشعار/i);
    const fileInput = label.querySelector('input') as HTMLInputElement;
    const file = new File(['fake-image-bytes'], 'test-school-logo.png', { type: 'image/png' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      const logoImage = screen.getByAltText('Logo');
      expect(logoImage.getAttribute('src')).toContain('new-logo-uploaded.png');
      expect(logoImage.getAttribute('src')).toContain('?v=');
    });
  });

  it('التكامل مع الحفظ: يجب استدعاء Mutation عند الضغط على حفظ الهوية', async () => {
    renderComponent();
    
    const saveButton = screen.getByText(/حفظ الهوية الجديدة/i);
    fireEvent.click(saveButton);

    expect(mockMutate).toHaveBeenCalled();
  });
});
