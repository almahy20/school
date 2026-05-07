import React, { ReactElement } from 'react';
import { render, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// نقوم بإنشاء Client جديد لكل اختبار لمنع تداخل الكاش
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false, // نغلق إعادة المحاولة لتسريع الفحص واصطياد الأخطاء بدقة
      cacheTime: 0,
      staleTime: 0,
    },
  },
});

export function renderWithClient(ui: ReactElement) {
  const testQueryClient = createTestQueryClient();
  const { rerender, ...result } = render(
    <QueryClientProvider client={testQueryClient}>{ui}</QueryClientProvider>
  );
  return {
    ...result,
    rerender: (rerenderUi: ReactElement) =>
      rerender(
        <QueryClientProvider client={testQueryClient}>{rerenderUi}</QueryClientProvider>
      ),
  };
}

export function renderHookWithClient<Result, Props>(
  render: (initialProps: Props) => Result
) {
  const testQueryClient = createTestQueryClient();
  return renderHook(render, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={testQueryClient}>{children}</QueryClientProvider>
    ),
  });
}
