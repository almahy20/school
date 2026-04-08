import { QueryClient, QueryCache, MutationCache, focusManager, dehydrate, hydrate } from "@tanstack/react-query";
import { toast } from "sonner";

// إعداد مستمعات أحداث النافذة (Visibility & Focus) لدعم التحديث الفوري على الأجهزة المحمولة والويب
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      focusManager.setFocused(true);
    } else {
      focusManager.setFocused(false);
    }
  });

  window.addEventListener('focus', () => focusManager.setFocused(true));
  window.addEventListener('blur', () => focusManager.setFocused(false));
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error: any, query) => {
      // Only show toast for actual data fetching queries that have failed multiple times
      if (query.state.fetchStatus === 'fetching' && query.state.status === 'error') {
        console.error(`[Global Query Error] ${query.queryKey}:`, error);
        
        // Don't spam toasts for network issues (HealthMonitor handles those)
        if (window.navigator.onLine) {
          toast.error("فشل تحديث البيانات", {
            description: "حدث خطأ أثناء جلب أحدث البيانات. سنحاول مرة أخرى تلقائياً.",
            id: `query-error-${JSON.stringify(query.queryKey)}`, // Prevent duplicates
          });
        }
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error: any, _variables, _context, mutation) => {
      console.error(`[Global Mutation Error]:`, error);
      toast.error("فشل تنفيذ العملية", {
        description: error.message || "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.",
      });
    },
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error) console.error(`[Query Error] Attempt ${failureCount}:`, error);
        if (failureCount < 2) return true;
        if (failureCount < 5) {
          const isNetworkError = typeof window !== 'undefined' && !window.navigator.onLine;
          const errorMessage = error?.message?.toLowerCase() || '';
          const isConnectionError = 
            errorMessage.includes('fetch') || 
            errorMessage.includes('network') ||
            errorMessage.includes('postgresterror') ||
            errorMessage.includes('failed to fetch');
          if (isNetworkError || isConnectionError) return true;
        }
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
      staleTime: 0, // Ensure data is immediately considered stale for re-validation
      gcTime: 5 * 60 * 1000,
      refetchIntervalInBackground: false,
    },
  },
});

// التخزين المحلي لضمان احتفاظ التطبيق (PWA) بالبيانات حتى لو أُغلق تماماً
if (typeof window !== 'undefined') {
  const PWA_CACHE_KEY = 'react-query-pwa-cache-v1';
  
  // استعادة البيانات فور تشغيل التطبيق (قبل أي طلبات شبكة)
  try {
    const saved = localStorage.getItem(PWA_CACHE_KEY);
    if (saved) {
      hydrate(queryClient, JSON.parse(saved));
      console.log('✅ PWA Offline Cache Restored');
    }
  } catch (e) {
    console.error('Failed to restore offline cache', e);
  }

  // دالة الحفظ الذكي للصالة
  const saveCache = () => {
    try {
      // نحفظ فقط البيانات الناجحة لتقليل الحجم
      const state = dehydrate(queryClient, { 
        shouldDehydrateQuery: (query) => query.state.status === 'success'
      });
      localStorage.setItem(PWA_CACHE_KEY, JSON.stringify(state));
    } catch (e) {
       // تجنب تحطم التطبيق إذا امتزأ localStorage
    }
  };

  // حفظ قبل الإغلاق أو عند خروج التطبيق للخلفية
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveCache();
  });
  window.addEventListener('beforeunload', saveCache);
  
  // حفظ احتياطي كل 10 ثواني كأقصى حد
  setInterval(saveCache, 10000);
}
