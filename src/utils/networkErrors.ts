/**
 * networkErrors — دالة موحدة لكشف أخطاء الشبكة
 * ─────────────────────────────────────────────────
 * تُستخدم في كل أنحاء التطبيق بدلاً من نسخ متكررة.
 * تتحقق من: فشل الاتصال، CORS، timeout، gateway errors، offline.
 */

/**
 * هل الخطأ ناتج عن مشكلة شبكة (وليس خطأ منطقي في الكود أو البيانات)؟
 * يُستخدم لتحديد: هل نعيد المحاولة؟ هل نعمل logout؟ هل نعرض رسالة خاصة؟
 */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false;

  // Offline check
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;

  // Extract message string from various error shapes
  const msg = extractErrorMessage(error).toLowerCase();

  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('cors') ||
    msg.includes('load resource') ||
    msg.includes('abort') ||
    msg.includes('timeout') ||
    msg.includes('gateway timeout') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('504') ||
    msg.includes('502') ||
    msg.includes('503') ||
    (error instanceof TypeError && msg.includes('fetch')) ||
    (error as any)?.status === 0 ||
    (error as any)?.name === 'TypeError'
  );
}

/** يستخرج نص الخطأ من أي شكل (Error, PostgrestError, string, object) */
function extractErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  const e = error as any;
  return [e?.message, e?.details, e?.code, e?.error_description, e?.msg]
    .filter(Boolean)
    .join(' ');
}
