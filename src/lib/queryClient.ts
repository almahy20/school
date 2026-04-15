import { QueryClient, QueryCache, MutationCache, focusManager, onlineManager } from "@tanstack/react-query";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";

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

  // Let React Query handle its own visibility and focus mapping natively
}



export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error: any, query) => {
      // Suppress 403/404 errors (expected during development)
      const isForbidden = error?.status === 403 || error?.message?.includes('403');
      const isNotFound = error?.status === 404 || error?.message?.includes('404');
      
      if (isForbidden || isNotFound) {
        return; // Silently ignore
      }
      
      // Only show toast for actual data fetching queries that have failed multiple times
      if (query.state.fetchStatus === 'fetching' && query.state.status === 'error') {
        logger.error(`[Global Query Error] ${query.queryKey}:`, error);
        
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
      // Suppress 403/404 errors in development (handled by RLS)
      const isForbidden = error?.status === 403 || error?.message?.includes('403');
      const isNotFound = error?.status === 404 || error?.message?.includes('404');
      
      if (isForbidden || isNotFound) {
        // Silently ignore - these are expected during development
        return;
      }
      
      logger.error(`[Global Mutation Error]:`, error);
      
      // Don't show error toast if we're offline - mutation will retry when back online
      if (!window.navigator.onLine) {
        logger.warn('[Mutation] Offline - mutation paused, will retry when online');
        return;
      }
      
      toast.error("فشل تنفيذ العملية", {
        description: error.message || "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.",
      });
    },
    onSuccess: (data: any, _variables, _context, mutation) => {
      // Log successful mutations for debugging
      logger.log('[Mutation] Successfully executed:', mutation.options.mutationKey);
    },
  }),
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst',
      retry: (failureCount, error: any) => {
        if (error) logger.error(`[Query Error] Attempt ${failureCount}:`, error);
        // Retry only for network errors, fail fast for other errors
        if (failureCount < 2) return true;
        if (failureCount < 3) {
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
      retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 10000),
      refetchOnWindowFocus: true, // Let React Query fetch on focus (vital for PWA backgrounding)
      refetchOnMount: true,
      refetchOnReconnect: true, // Automatic fetch on reconnection
      // Cache data for 5 minutes - prevents excessive refetching
      staleTime: 1000 * 60 * 5, // 5 minutes - professional app behavior
      // Keep cached data for 30 minutes (not 24h - saves memory)
      gcTime: 30 * 60 * 1000, // 30 minutes
      refetchIntervalInBackground: false,
      structuralSharing: true,
      // Show cached data immediately while refetching in background
      placeholderData: (previousData: any) => previousData,
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 5000),
    },
  },
});
