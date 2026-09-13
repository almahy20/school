import { createClient, PostgrestError } from '@supabase/supabase-js';
import type { Database } from './types';
import { logger } from '@/utils/logger';

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

const handleAuthFailure = (reason: string) => {
  logger.log(`[Supabase] Auth event: ${reason} — handled by AuthContext`);
};

// ── Circuit Breaker to prevent request spam when Supabase is unreachable ──
type CircuitState = 'closed' | 'open' | 'half-open';
interface CircuitBreaker {
  state: CircuitState;
  failCount: number;
  lastFailTime: number;
  nextRetryTime: number;
}

const MAX_FAILURES_BEFORE_OPEN = 5;
const OPEN_RESET_MS = 30_000;
const FAILURE_WINDOW_MS = 60_000;

const circuit: CircuitBreaker = {
  state: 'closed',
  failCount: 0,
  lastFailTime: 0,
  nextRetryTime: 0,
};

const isNetworkError = (err: unknown): boolean => {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('cors') ||
    msg.includes('load resource') ||
    msg.includes('abort') ||
    msg.includes('timeout') ||
    msg.includes('gateway timeout') ||
    (err as any).name === 'AbortError' ||
    (err as any).name === 'TypeError'
  );
};

const recordFailure = () => {
  const now = Date.now();
  if (now - circuit.lastFailTime > FAILURE_WINDOW_MS) circuit.failCount = 0;
  circuit.failCount++;
  circuit.lastFailTime = now;
  if (circuit.failCount >= MAX_FAILURES_BEFORE_OPEN && circuit.state === 'closed') {
    circuit.state = 'open';
    circuit.nextRetryTime = now + OPEN_RESET_MS;
    logger.warn(
      `[Supabase] Circuit Breaker OPEN after ${circuit.failCount} failures. ` +
      `Pausing new requests for ${OPEN_RESET_MS / 1000}s. ` +
      `Possible causes: CORS misconfiguration, 504 Gateway Timeout, or no internet.`
    );
  }
};

const recordSuccess = () => {
  circuit.failCount = 0;
  if (circuit.state !== 'closed') {
    circuit.state = 'closed';
    logger.log('[Supabase] Circuit Breaker CLOSED — connection restored.');
  }
};

const canMakeRequest = (url: string): boolean => {
  const now = Date.now();
  if (circuit.state === 'closed') return true;
  if (circuit.state === 'open') {
    if (now >= circuit.nextRetryTime) {
      circuit.state = 'half-open';
      logger.log('[Supabase] Circuit Breaker HALF-OPEN — testing connectivity...');
      return true;
    }
    if (isAuthEndpoint(url)) return true;
    return false;
  }
  return true;
};

const makeCorsSafeError = (err: unknown): Error => {
  if (err instanceof TypeError && isNetworkError(err)) {
    const hint =
      '\n💡 نصيحة: تأكد من إضافة http://localhost:3000 إلى قائمة CORS Origins في إعدادات Supabase.' +
      '\n   المسار في Dashboard: Authentication → URL Configuration أو Settings → API.' +
      '\n   أو تحقق من أن مشروع Supabase يعمل حالياً (قد يكون هناك 504 مؤقتاً).';
    const newErr = new Error(err.message + hint);
    (newErr as any).isCorsOrNetwork = true;
    return newErr;
  }
  return err as Error;
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storageKey: 'school_auth_token',
    storage: window.localStorage,
    flowType: 'pkce',
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
      if (!canMakeRequest(url)) {
        const retryIn = Math.max(0, Math.ceil((circuit.nextRetryTime - Date.now()) / 1000));
        logger.debug(`[Supabase] Request blocked by Circuit Breaker (${retryIn}s left): ${typeof url === 'string' ? new URL(url).pathname : url}`);
        throw new Error(`Supabase temporarily unavailable. Retry in ${retryIn}s.`);
      }

      const controller = new AbortController();
      const externalSignal = options.signal;
      const abortFromCaller = () => controller.abort();
      externalSignal?.addEventListener('abort', abortFromCaller, { once: true });
      const timeoutId = window.setTimeout(() => controller.abort(), 20_000);

      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        recordSuccess();

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
          } catch {
            // response body unreadable — skip auth failure detection
          }
        }

        if (res.status === 502 || res.status === 503 || res.status === 504) {
          recordFailure();
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
          } catch {
            // response body unreadable — skip auth failure detection
          }
        }
        return res;
      } catch (err) {
        if (isNetworkError(err)) {
          recordFailure();
          throw makeCorsSafeError(err);
        }
        throw err;
      } finally {
        window.clearTimeout(timeoutId);
        externalSignal?.removeEventListener('abort', abortFromCaller);
      }
    },
  },
  db: {
    schema: 'public'
  }
});

export { isAuthError };
