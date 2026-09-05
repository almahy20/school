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
      // ✅ Stale-While-Revalidate: Serve from cache, background refresh only when needed
      staleTime: 60 * 1000, // 1 minute (prevents spamming Supabase API on rapid page switches)
      gcTime: 30 * 60 * 1000, // 30 minutes in RAM (automatically frees memory for unmounted pages)
      refetchOnWindowFocus: false, // Prevents request storm when user tabs switch
      refetchOnMount: true, // Refetch only when component mounts and data is stale (>60s)
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

// ✅ Optimization: IndexedDB Query Persistence with Strict Whitelisting
if (typeof window !== 'undefined') {
  // VERSION: Increment this whenever you make major schema changes to force clear all clients' cache
  const CACHE_VERSION = 'v2.1'; // bumped: ultra-lean cache whitelist (branding only)

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
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    buster: CACHE_VERSION, // ✅ Forces cache clear when version changes
    shouldPersistQuery: (query) => {
      // Don't persist errors, pending states, or temporary data
      if (query.state.status !== 'success') return false;
      if (query.meta?.persist === false) return false;

      // ✅ أمان وأداء مطلق للأجهزة الضعيفة:
      // نخزن فقط هوية المدرسة وشعارها لفتح التطبيق فوراً بشعار المدرسة.
      // أي بيانات ديناميكية (طلاب، درجات، غياب، رسائل، فصول) تبقى في ذاكرة الـ RAM المؤقتة فقط
      // لمنع تراكم الملفات وتضخم مساحة التخزين على هاتف المستخدم نهائياً.
      const key = String(query.queryKey[0]);
      return key === 'school-branding' || key === 'school-by-slug';
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

