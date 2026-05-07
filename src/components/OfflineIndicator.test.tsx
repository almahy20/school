import { render, screen, act } from '@testing-library/react';
import { OfflineIndicator } from './OfflineIndicator';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('OfflineIndicator', () => {
  beforeEach(() => {
    // نجعل المتصفح افتراضياً "متصل بالإنترنت"
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('يجب أن لا يظهر المكون إذا كان المستخدم متصلاً بالإنترنت منذ البداية', () => {
    const { container } = render(<OfflineIndicator />);
    // بما أنه أونلاين وصار جاهز، لن يُرندَر أي شيء (يُعيد null)
    expect(container.firstChild).toBeNull();
  });

  it('يجب أن يظهر رسالة غير متصل إذا فقد الجهاز اتصاله بالإنترنت', () => {
    render(<OfflineIndicator />);
    
    // محاكاة انقطاع الإنترنت
    act(() => {
      Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
      window.dispatchEvent(new Event('offline'));
    });

    // يجب أن يبحث المكون ويظهر شريط الانقطاع
    expect(screen.getByText(/أنت تعمل الآن في وضع عدم الاتصال/i)).toBeInTheDocument();
  });

  it('يجب أن يظهر شريط العودة للإنترنت ثم يختفي بعد 3 ثوان', () => {
    render(<OfflineIndicator />);

    // انقطاع أولاً
    act(() => {
      Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
      window.dispatchEvent(new Event('offline'));
    });

    // عودة الاتصال
    act(() => {
      Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
      window.dispatchEvent(new Event('online'));
    });

    // التحقق من ظهور رسالة عودة الاتصال
    expect(screen.getByText(/تم استعادة الاتصال بالإنترنت/i)).toBeInTheDocument();

    // تسريع الزمن 3.5 ثواني
    act(() => {
      vi.advanceTimersByTime(3500);
    });

    // بعد مرور 3.5 ثانية، من المفترض أن يختفي المكون بالكامل (null)
    expect(screen.queryByText(/تم استعادة الاتصال بالإنترنت/i)).not.toBeInTheDocument();
  });
});
