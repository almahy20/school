import { QueryClient, QueryCache, MutationCache, focusManager, onlineManager } from "@tanstack/react-query";
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { del, get, set } from 'idb-keyval';
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";

// إعداد مستمعات أحداث النافذة (Visibility & Focus) لدعم التحديث الفوري على الأجهزة المحمولة والويب
if (typeof window !== 'undefined') {
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
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // ✅ Stale-While-Revalidate: Instant UI from IndexedDB cache, silent background refetch after 10s
      staleTime: 10 * 1000, // 10 seconds - fast navigation without data staleness
      gcTime: 24 * 60 * 60 * 1000, // 24 hours - keep in IndexedDB for instant UI hydration
      refetchOnWindowFocus: true, // Silent background refetch when user returns to tab/window
      refetchOnMount: true, // Refetch on component mount when stale
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
    mutations: {
      onSuccess: () => {
        // Individual mutations manage their targeted cache invalidation
      },
    }
  },
  queryCache: new QueryCache({
    onError: (error) => logger.error('Global Query Error:', error),
  }),
  mutationCache: new MutationCache({
    onError: (error) => logger.error('Global Mutation Error:', error),
  }),
});

// ✅ Optimization: IndexedDB Query Persistence with Versioning
if (typeof window !== 'undefined') {
  // VERSION: Increment this whenever you make major schema changes to force clear all clients' cache
  const CACHE_VERSION = 'v2.0'; // bumped: fresh cache reset with fast SWR defaults

  const idbPersister = {
    persistClient: async (client: any) => {
      await set('SCHOOL_APP_CACHE', client);
    },
    restoreClient: async () => {
      return await get('SCHOOL_APP_CACHE');
    },
    removeClient: async () => {
      await del('SCHOOL_APP_CACHE');
    },
  };

  persistQueryClient({
    queryClient,
    persister: idbPersister,
    maxAge: 12 * 60 * 60 * 1000, // 12 hours
    buster: CACHE_VERSION, // ✅ Forces cache clear when version changes
    shouldPersistQuery: (query) => {
      // Don't persist errors or temporary states
      if (query.state.status === 'error') return false;
      
      // ✅ Don't persist queries that are marked as 'no-persist' in their meta
      if (query.meta?.persist === false) return false;

      // ✅ Don't persist child-full-details — they're heavy and cause unwanted
      // background refetches on every page load via the persist client restore
      const key = query.queryKey[0];
      if (key === 'child-full-details') return false;

      return true;
    },
  });
}

/**
 * ✅ Security: Clear all persisted cache (IndexedDB + in-memory) on logout
 * Prevents cross-tenant data leakage
 */
export async function clearAllCache() {
  queryClient.clear();
  try {
    await del('SCHOOL_APP_CACHE');
  } catch (e) {
    logger.error('Failed to clear IndexedDB cache:', e);
  }
}

