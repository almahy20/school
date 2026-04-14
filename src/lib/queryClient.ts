import { QueryClient, QueryCache, MutationCache, focusManager, onlineManager } from "@tanstack/react-query";
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
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

  // Note: Visibility/Focus handlers are now coordinated by HealthMonitor
  // to prevent concurrent Auth/Data load race conditions.
}

// Create a persister for offline cache persistence
export const queryPersister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'school-app-query-cache',
  // Only persist successful queries
  serialize: (data) => JSON.stringify(data),
  deserialize: (data) => JSON.parse(data),
});

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
      refetchOnWindowFocus: false, // Managed manually by HealthMonitor
      refetchOnMount: true,
      refetchOnReconnect: false, // Managed manually by HealthMonitor
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
