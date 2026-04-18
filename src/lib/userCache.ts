/**
 * userCache — كاش بيانات المستخدم في localStorage
 * ─────────────────────────────────────────────────
 * الهدف: عرض التطبيق فوراً عند الريلود بدون شاشة "جاري التحضير"
 * لأن بيانات المستخدم محفوظة محلياً، والتحقق يحدث في الخلفية.
 */

import type { AppUser } from '@/types/auth';

const CACHE_KEY = 'school-user-v1';

/** قراءة بيانات المستخدم المحفوظة (sync — لا تحتاج await) */
export function getCachedUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch {
    return null;
  }
}

/** حفظ بيانات المستخدم بعد كل تحديث ناجح */
export function setCachedUser(user: AppUser | null): void {
  try {
    if (user) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CACHE_KEY);
    }
  } catch { /* ignore quota errors */ }
}
