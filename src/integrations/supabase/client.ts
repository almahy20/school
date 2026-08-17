import { createClient, PostgrestError } from '@supabase/supabase-js';
import type { Database } from './types';
import { queryClient, clearAllCache } from '@/lib/queryClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

const isAuthError = (error: unknown): boolean => {
  const pgErr = error as PostgrestError;
  return (
    pgErr?.code === '42501' ||
    pgErr?.message?.includes('permission denied') ||
    (typeof pgErr?.message === 'string' &&
      (pgErr.message.includes('JWT') ||
        pgErr.message.includes('expired') ||
        pgErr.message.includes('invalid token')))
  );
};

const isAuthEndpoint = (url: string): boolean => {
  try {
    const u = new URL(url);
    return u.pathname.includes('/auth/v1/');
  } catch {
    return false;
  }
};

const handleAuthFailure = async (reason: string) => {
  // ✅ تم تعطيل الـ auto force-signout — المستخدم يفضل logged in
  // logout بيحصل بس من زر تسجيل الخروج اليدوي
  console.log(`[Supabase] Auth event detected: ${reason} — no action (manual sign out only)`);
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'school_auth_token',
    storage: window.localStorage,
    flowType: 'pkce',
    lockStorageAcrossTabs: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 40,
    }
  },
  global: {
    headers: {
      'x-client-info': 'school-app'
    },
    fetch: async (url, options = {}) => {
      const res = await fetch(url, options);

      if (res.status === 400 && isAuthEndpoint(url)) {
        try {
          const cloned = res.clone();
          const contentType = cloned.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const body = await cloned.json();
            if (
              body?.error === 'invalid_grant' ||
              body?.error === 'invalid_request' ||
              body?.error_description?.includes('refresh_token') ||
              body?.msg?.includes('refresh_token') ||
              (typeof body?.message === 'string' && body.message.includes('refresh'))
            ) {
              handleAuthFailure(`refresh token 400: ${JSON.stringify(body)}`);
            }
          }
        } catch {}
      }

      if (res.status === 401 || (res.status === 403 && isAuthEndpoint(url))) {
        try {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const cloned = res.clone();
            const body = await cloned.json();
            if (
              body?.message?.includes('JWT') ||
              body?.message?.includes('token') ||
              body?.error === 'invalid_token' ||
              body?.error === 'unauthorized' ||
              res.status === 403
            ) {
              const { data } = await supabase.auth.getSession();
              if (!data.session) {
                handleAuthFailure(`${res.status} received with no session`);
              } else {
                console.warn(`[Supabase] ${res.status} received but session still present — will let TOKEN_REFRESH_FAILED handle cleanup`);
              }
            }
          }
        } catch {}
      }
      return res;
    },
  },
  db: {
    schema: 'public'
  }
});

export { isAuthError };
