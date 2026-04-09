import { QueryClient, QueryCache, MutationCache, focusManager, onlineManager } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// إعداد مستمعات أحداث النافذة (Visibility & Focus) لدعم التحديث الفوري على الأجهزة المحمولة والويب
if (typeof window !== 'undefined') {
  // Setup online manager to use browser's navigator.onLine
  onlineManager.setEventListener((setOnline) => {
    const onlineHandler = () => setOnline(true);
    const offlineHandler = () => setOnline(false);
    
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    
    return () => {
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    };
  });

  const handleVisibilityChange = async () => {
    if (document.visibilityState === 'visible') {
      focusManager.setFocused(true);
      
      // تأكد من صحة الجلسة قبل محاولة استئناف العمليات أو تحديث البيانات
      try {
        await supabase.auth.getSession();
      } catch (e) {
        console.warn('[QueryClient] Failed to refresh session on focus:', e);
      }

      // Delay slightly to ensure connections are re-established
      setTimeout(() => {
        queryClient.resumePausedMutations();
        queryClient.invalidateQueries({ type: 'active' });
      }, 300);
    } else {
      focusManager.setFocused(false);
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleVisibilityChange);
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
      
      // Don't show error toast if we're offline - mutation will retry when back online
      if (!window.navigator.onLine) {
        console.warn('[Mutation] Offline - mutation paused, will retry when online');
        return;
      }
      
      toast.error("فشل تنفيذ العملية", {
        description: error.message || "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.",
      });
    },
    onSuccess: (data: any, _variables, _context, mutation) => {
      // Log successful mutations for debugging
      console.log('[Mutation] Successfully executed:', mutation.options.mutationKey);
    },
  }),
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst',
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
      gcTime: 24 * 60 * 60 * 1000,
      refetchIntervalInBackground: false,
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
});
