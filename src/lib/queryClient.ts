import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
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
      staleTime: 10 * 1000,
      gcTime: 5 * 60 * 1000,
    },
  },
});
