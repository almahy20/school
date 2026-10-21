import { useEffect, useState } from 'react';

/**
 * بوابة للاستعلامات الثانوية (شارات "غير المقروء" في الشريط الجانبي/الشريط السفلي).
 *
 * السبب: هذه الشارات تُطلق طلبات `HEAD ... count` إضافية عند كل فتح صفحة، وتتنافس
 * مع استعلامات المحتوى الأساسي (الطلاب/الفصول/المناهج) على نفس اتصالات الـ API،
 * فتُطيل زمن أول رسم. لذلك نؤجّلها لما الصفحة تفضى بدل ما تتحمّل مع أول تحميل.
 *
 * @param delayMs مهلة مبدئية قبل انتظار خمول المتصفح
 */
export function useDeferredSecondaryQueries(delayMs = 400): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const enable = () => {
      if (!cancelled) setReady(true);
    };

    let idleId: number | undefined;
    const timer = window.setTimeout(() => {
      if ('requestIdleCallback' in window) {
        idleId = (window as any).requestIdleCallback(enable, { timeout: 1500 });
      } else {
        enable();
      }
    }, delayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (idleId !== undefined && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleId);
      }
    };
  }, [delayMs]);

  return ready;
}
