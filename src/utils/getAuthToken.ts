import { supabase } from '@/integrations/supabase/client';

/**
 * Returns a valid Bearer token for the current session.
 * Tries getSession() first, then refreshSession() as a fallback.
 * Throws a clear error if no session is available so callers can handle it early.
 */
export async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.access_token) {
    return session.access_token;
  }

  // Session may have expired — try to refresh once
  const { data: { session: refreshed }, error } = await supabase.auth.refreshSession();

  if (refreshed?.access_token) {
    return refreshed.access_token;
  }

  throw new Error(
    error?.message || 'لم يتم العثور على جلسة نشطة. يرجى تسجيل الدخول مجدداً.'
  );
}

/**
 * Asserts that a valid session exists before calling an edge function.
 * The supabase client automatically injects the Authorization header,
 * so we only need to ensure the session is active — no need to pass headers manually.
 */
export async function assertSession(): Promise<void> {
  await getAuthToken(); // throws if no valid session
}

/**
 * @deprecated Use assertSession() instead — the supabase client auto-injects Authorization.
 * Kept for compatibility during migration.
 */
export async function getAuthHeader(): Promise<{ Authorization: string }> {
  const token = await getAuthToken();
  return { Authorization: `Bearer ${token}` };
}
