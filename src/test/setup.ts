import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// تنظيف الـ DOM بعد كل اختبار (تصحيح مشاكل RTL مع React 18)
afterEach(() => {
  cleanup();
});

// تعريف متغيرات البيئة الافتراضية للـ tests (تجنب أخطاء import.meta.env)
if (typeof process !== 'undefined') {
  process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://test.supabase.co';
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'test-publishable-key';
  process.env.VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'test-anon-key';
  process.env.VITE_VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY || 'test-vapid-key';
}

// محاكاة matchMedia (مطلوب لمكتبات UI كثيرة في jsdom)
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// محاكاة ResizeObserver (مطلوب لمكونات Shadcn/UI و Radix الحديثة)
if (typeof window !== 'undefined' && !('ResizeObserver' in window)) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: ResizeObserverMock,
  });
}

// محاكاة IntersectionObserver (مطلوب لمكونات التمرير والـ Lazy Loading)
if (typeof window !== 'undefined' && !('IntersectionObserver' in window)) {
  class IntersectionObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  }
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    value: IntersectionObserverMock,
  });
}
