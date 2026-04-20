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
      // ✅ Optimization: "Fast Start, Fresh Data" Pattern
      // We set staleTime to a low value (30s) so that the app REFRESHS data frequently,
      // but we keep gcTime high so that IndexedDB can show "old" data while loading.
      staleTime: 30 * 1000, // 30 seconds - refresh more often to avoid "stale" feeling
      gcTime: 24 * 60 * 60 * 1000, // 24 hours - keep in IndexedDB for fast starts
      refetchOnWindowFocus: false,
      refetchOnMount: true, // Always check for fresh data when a component mounts
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
    mutations: {
      onSuccess: () => {
        // Clear specific related caches or all if needed
        queryClient.invalidateQueries({ refetchType: 'all' });
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
  const CACHE_VERSION = 'v1.1'; 

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

      return true;
    },
  });
}

