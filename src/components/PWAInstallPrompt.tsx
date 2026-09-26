import { useEffect, useState, useCallback } from 'react';
import { Download, Smartphone, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { logger } from '@/utils/logger';

const INSTALLED_KEY = 'pwa_installed';
const SNOOZED_KEY = 'pwa_install_snoozed_until';
const DISMISS_COUNT_KEY = 'pwa_install_dismiss_count';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function getSnoozeDuration(dismissCount: number): number {
  if (dismissCount <= 1) return 8 * HOUR;
  if (dismissCount === 2) return 24 * HOUR;
  return 3 * DAY;
}

export default function PWAInstallPrompt() {
  const { canInstall, isStandalone, promptInstall } = usePWAInstall();
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const hasPromptGlobal = useCallback(() => !!(
    (window as any).deferredPrompt ||
    (window as any).__pwaBoot?.prompt
  ), []);

  const checkAndShow = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone) return;
    if (localStorage.getItem(INSTALLED_KEY) === '1') return;

    const snoozedUntil = Number(localStorage.getItem(SNOOZED_KEY) ?? 0);
    if (snoozedUntil && Date.now() < snoozedUntil) return;

    const hasPrompt = hasPromptGlobal() || canInstall;

    if (hasPrompt) {
      logger.log('[PWAInstallPrompt] Deferred prompt available — showing real install dialog');
      setIsVisible(true);
    }
  }, [isStandalone, canInstall, hasPromptGlobal]);

  useEffect(() => {
    checkAndShow();

    const t1 = setTimeout(checkAndShow, 1000);
    const t2 = setTimeout(checkAndShow, 3000);
    const t3 = setTimeout(checkAndShow, 6000);
    const t4 = setTimeout(checkAndShow, 12000);

    const onFocus = () => {
      logger.log('[PWAInstallPrompt] Window focus — rechecking prompt');
      checkAndShow();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') onFocus();
    });

    window.addEventListener('pwa:prompt-ready', onFocus);
    window.addEventListener('pwa:sw-ready', onFocus);
    window.addEventListener('pwa:install-ready', onFocus);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pwa:prompt-ready', onFocus);
      window.removeEventListener('pwa:sw-ready', onFocus);
      window.removeEventListener('pwa:install-ready', onFocus);
    };
  }, [checkAndShow]);

  useEffect(() => {
    if (canInstall) checkAndShow();
  }, [canInstall, checkAndShow]);

  const handleDismiss = () => {
    const currentCount = Number(localStorage.getItem(DISMISS_COUNT_KEY) ?? 0);
    const nextCount = currentCount + 1;
    localStorage.setItem(DISMISS_COUNT_KEY, String(nextCount));
    const duration = getSnoozeDuration(nextCount);
    const until = Date.now() + duration;
    localStorage.setItem(SNOOZED_KEY, String(until));
    logger.log(`[PWAInstallPrompt] Dismissed #${nextCount} — snoozed until ${new Date(until).toLocaleString()}`);
    setIsVisible(false);
  };

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      const result = await promptInstall();
      if (result === 'accepted') {
        localStorage.setItem(INSTALLED_KEY, '1');
        setIsVisible(false);
      } else {
        handleDismiss();
      }
    } finally {
      setIsInstalling(false);
    }
  };

  if (!isVisible || isStandalone) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] animate-in fade-in duration-300" />
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" dir="rtl">
          <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-8 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.1),transparent)]" />
            <div className="relative z-10">
              <div className="w-20 h-20 mx-auto bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mb-4 shadow-xl">
                <Smartphone className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">ثبت التطبيق الآن</h2>
              <p className="text-white/80 text-sm font-medium">استفد من كل مميزات النظام بشكل أسرع وأسهل</p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="space-y-3">
              {[
                'فتح سريع بضغطة واحدة من الشاشة الرئيسية',
                'إشعارات فورية حتى لو التطبيق مغلق',
                'تجربة تطبيق أصيل بدون متصفح',
                'أداء أفضل واستهلاك أقل للإنترنت',
              ].map((text) => (
                <div key={text} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-sm font-medium">{text}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={handleDismiss}
                className="flex-1 h-14 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                ليس الآن
              </button>
              <button
                type="button"
                onClick={handleInstall}
                disabled={isInstalling}
                className="flex-1 h-14 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-base shadow-xl shadow-indigo-600/30 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {isInstalling ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>جاري التثبيت...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>تثبيت</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
