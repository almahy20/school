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
      // ✅ Stale-While-Revalidate: عرض فوري من الكاش وتحديث صامت في الخلفية لجلب أحدث البيانات دائماً
      networkMode: 'offlineFirst',
      staleTime: 10 * 1000, // 10 ثوانٍ: أي بيانات في الكاش تعرض فوراً ويعاد التحقق في الخلفية
      gcTime: 60 * 60 * 1000, // ساعة كاملة في ذاكرة الـ RAM
      refetchOnWindowFocus: true, // تحديث تلقائي عند العودة للتطبيق
      refetchOnMount: true, // تحديث صامت في الخلفية عند دخول الصفحة
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 6000),
    },
    mutations: {
      networkMode: 'offlineFirst',
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

// ✅ Optimization: IndexedDB Query Persistence with Smart Whitelisting
if (typeof window !== 'undefined') {
  // VERSION: Increment this whenever you make major schema changes to force clear all clients' cache
  const CACHE_VERSION = 'v2.2'; // bumped: smart offline cache for instant mobile load

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

      // ✅ استراتيجية ذكية: حفظ البيانات الرئيسية في ذاكرة الهاتف لتفتح الصفحات في أجزاء من الثانية
      const key = String(query.queryKey[0]);
      const allowedKeys = [
        'school-branding',
        'school-by-slug',
        'profile',
        'parent-children',
        'child-full-details',
        'students',
        'classes',
        'teachers',
        'parents',
        'attendance',
        'grades',
        'fees',
        'notifications',
        'curriculum'
      ];
      return allowedKeys.includes(key);
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

