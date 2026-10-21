import { QueryClient, QueryCache, MutationCache, focusManager, onlineManager } from "@tanstack/react-query";
import { persistQueryClient } from '@tanstack/react-query-persist-client';
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
      // ✅ Event-Driven Caching: الانتقال بين الصفحات فوري (0ms) مع إعادة التحقق في الخلفية إن كانت البيانات قديمة
      networkMode: 'offlineFirst',
      staleTime: 60 * 1000, // 1 دقيقة لتوازن مثالي بين السرعة وتحديث البيانات
      gcTime: 24 * 60 * 60 * 1000, // 24 ساعة (مطابق لـ maxAge لضمان استمرارية الكاش)
      refetchOnWindowFocus: false, // لا تعيد الجلب عند فوكس النافذة — هدوء واستقرار تام
      refetchOnReconnect: true, // صمام أمان: فحص التحديثات تلقائياً عند عودة الاتصال بالإنترنت
      refetchOnMount: true, // ✅ عرض فوري من الكاش أولاً (0ms) مع تحديث هادئ بالخلفية إذا كانت البيانات فارغة أو stale
      retry: 1,
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
// ⚠️ BUSTER POLICY: يُعدل هذا المتغير يدوياً فقط عند حدوث تغيير جذري في بنية البيانات (Schema Breaking Change).
// لا يرتبط بـ version.json أو buildTimestamp لضمان بقاء كاش البيانات مستقراً عبر التحديثات وإعادة تحميل الكود فقط.
export const CACHE_VERSION = 'v2.2';

export const idbPersister = {
  persistClient: async (client: any) => {
    try {
      await set('SCHOOL_APP_CACHE', client);
    } catch (e) {
      logger.warn('[queryClient] Failed to persist cache to IndexedDB:', e);
    }
  },
  restoreClient: async () => {
    try {
      // ⏱️ Timeout safeguard (1.5s): إذا تأخر IndexedDB عن الاستجابة لا يحجب فتح التطبيق
      const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(undefined), 1500));
      const getPromise = get('SCHOOL_APP_CACHE');
      const result = await Promise.race([getPromise, timeoutPromise]);
      return result;
    } catch (e) {
      logger.warn('[queryClient] Failed to restore cache from IndexedDB:', e);
      return undefined;
    }
  },
  removeClient: async () => {
    try {
      await del('SCHOOL_APP_CACHE');
    } catch (e) {
      logger.warn('[queryClient] Failed to remove cache from IndexedDB:', e);
    }
  },
};

export const persistOptions = {
  persister: idbPersister,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  buster: CACHE_VERSION, // ✅ Forces cache clear when version changes
  shouldPersistQuery: (query: any) => {
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
      'teacher-classes',
      'parents',
      'parent-extra-data',
      'attendance',
      'student-attendance',
      'student-attendance-summary',
      'teacher-attendance',
      'grades',
      'student-grades',
      'student-grades-full',
      'fees',
      'electronic-exams',
      'conversations',
      'conversation',
      'conversation-messages',
      'conversations-parent-unread',
      'class-chat-rooms',
      'class-chat-messages',
      'notifications',
      'notifications-unread-counts',
      'unread-announcements',
      'curriculum',
      'admin-stats',
      'teacher-stats',
      'admin-activities',
      'admin-dashboard-summary',
      'users'
    ];
    return allowedKeys.includes(key);
  },
};

/**
 * ✅ Security: Clear all persisted cache (IndexedDB + in-memory) on logout
 * Prevents cross-tenant data leakage
 */
// قائمة المفاتيح الصريحة والبادئات المحددة المطلوب مسحها عند تسجيل الخروج أو تغيير المستخدم
export const CACHE_LOCAL_STORAGE_KEYS = [
  'school_auth_token',
  'app_user_cache_v2',
  'last_auth_sync',
  'active_chat_room',
  'chat_draft',
  'conversation_draft',
  'selected_conversation_id',
] as const;

export const CACHE_LOCAL_STORAGE_PREFIXES = [
  'exam_cards_',
  'branding_',
  'dismissed-announcements-',
  'chat_draft_',
  'conversation_draft_',
] as const;

export const CACHE_SESSION_STORAGE_KEYS = [
  'user_signup_time',
  'no_remember_me',
] as const;

export const CACHE_SESSION_STORAGE_PREFIXES = [
  'exam_progress_',
  'exam_attempt_',
  'grades:order:',
] as const;

export async function clearAllCache() {
  queryClient.clear();
  try {
    await del('SCHOOL_APP_CACHE');
  } catch (e) {
    logger.error('Failed to clear IndexedDB cache:', e);
  }

  // تنظيف المفاتيح المحددة فقط من localStorage
  try {
    // 1. المفاتيح الصريحة
    CACHE_LOCAL_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));

    // 2. المفاتيح ذات البادئات الديناميكية المحددة
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && CACHE_LOCAL_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    logger.error('Failed to clear localStorage cached keys:', e);
  }

  // تنظيف المفاتيح المحددة فقط من sessionStorage
  try {
    // 1. المفاتيح الصريحة
    CACHE_SESSION_STORAGE_KEYS.forEach((k) => sessionStorage.removeItem(k));

    // 2. المفاتيح ذات البادئات الديناميكية المحددة
    const sessionKeysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && CACHE_SESSION_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        sessionKeysToRemove.push(key);
      }
    }
    sessionKeysToRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch (e) {
    logger.error('Failed to clear sessionStorage cached keys:', e);
  }
}

