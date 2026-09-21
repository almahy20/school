import { useEffect, useState, useCallback, useRef } from 'react';
import { Download, Smartphone, CheckCircle2, Info, Share2 } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { IOSPwaGuideModal } from '@/components/IOSPwaGuideModal';
import { logger } from '@/utils/logger';

const INSTALLED_KEY = 'pwa_installed';
const SNOOZED_KEY = 'pwa_install_snoozed_until';
const DISMISS_COUNT_KEY = 'pwa_install_dismiss_count';
const MANUAL_SEEN_KEY = 'pwa_manual_guide_seen';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function getSnoozeDuration(dismissCount: number): number {
  if (dismissCount <= 1) return 8 * HOUR;
  if (dismissCount === 2) return 24 * HOUR;
  return 3 * DAY;
}

const getIsIOS = () =>
  typeof window !== 'undefined' &&
  /iPhone|iPad|iPod/.test(navigator.userAgent) &&
  !(window as any).MSStream;

const getIsAndroidChrome = () =>
  typeof window !== 'undefined' &&
  /Android/.test(navigator.userAgent) &&
  /Chrome|Chromium|Edg/.test(navigator.userAgent);

const getIsDesktopChrome = () =>
  typeof window !== 'undefined' &&
  !/Android|iPhone|iPad|iPod|Mobile/.test(navigator.userAgent) &&
  /Chrome|Chromium|Edg/.test(navigator.userAgent);

export default function PWAInstallPrompt() {
  const { canInstall, isStandalone, isIOS, promptInstall } = usePWAInstall();
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const iosComputed = useRef(getIsIOS());

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

    const effectiveIsIOS = iosComputed.current;

    if (effectiveIsIOS) {
      logger.log('[PWAInstallPrompt] iOS detected — showing manual guide');
      setMode('manual');
      setIsVisible(true);
      return;
    }

    const hasPrompt = hasPromptGlobal() || canInstall;

    if (hasPrompt) {
      logger.log('[PWAInstallPrompt] Deferred prompt available — showing auto install dialog');
      setMode('auto');
      setIsVisible(true);
      return;
    }

    if (import.meta.env.PROD) {
      const androidChrome = getIsAndroidChrome();
      const desktopChrome = getIsDesktopChrome();
      const manualSeen = Number(localStorage.getItem(MANUAL_SEEN_KEY) ?? 0);
      const oneDayAgo = Date.now() - DAY;

      if ((androidChrome || desktopChrome) && manualSeen < oneDayAgo) {
        logger.log('[PWAInstallPrompt] No deferred prompt (Chrome cooldown) — showing manual install guide');
        setMode('manual');
        setIsVisible(true);
      }
    }
  }, [isStandalone, canInstall, hasPromptGlobal]);

  useEffect(() => {
    checkAndShow();

    const t1 = setTimeout(checkAndShow, 2000);
    const t2 = setTimeout(checkAndShow, 5000);
    const t3 = setTimeout(checkAndShow, 10000);
    const t4 = setTimeout(checkAndShow, 20000);

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
    if (mode === 'manual') {
      localStorage.setItem(MANUAL_SEEN_KEY, String(Date.now()));
    }
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
    const result = await promptInstall();
    setIsInstalling(false);

    if (result === 'accepted') {
      localStorage.setItem(INSTALLED_KEY, '1');
      setIsVisible(false);
      return;
    }

    if (result === 'dismissed') {
      logger.log('[PWAInstallPrompt] Native prompt dismissed by user — switching to manual guide');
      setMode('manual');
      localStorage.setItem(MANUAL_SEEN_KEY, String(Date.now() - 23 * HOUR));
      return;
    }

    if (result === 'unavailable') {
      logger.log('[PWAInstallPrompt] prompt() unavailable — switching to manual guide');
      setMode('manual');
    }
  };

  if (!isVisible || isStandalone) return null;

  if (iosComputed.current) {
    return (
      <IOSPwaGuideModal
        open={isVisible}
        onClose={handleDismiss}
      />
    );
  }

  if (mode === 'manual') {
    const isAndroid = getIsAndroidChrome();
    return (
      <>
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] animate-in fade-in duration-300" />
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" dir="rtl">
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-8 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.1),transparent)]" />
              <div className="relative z-10">
                <div className="w-20 h-20 mx-auto bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mb-4 shadow-xl">
                  <Share2 className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-black text-white mb-2">ثبت التطبيق يدوياً</h2>
                <p className="text-white/90 text-sm font-medium">
                  المتصفح يمنع المطالبة التلقائية حالياً، لكن يمكنك التثبيت بسهولة من القائمة
                </p>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-3">
                {isAndroid ? (
                  [
                    { step: 1, text: 'اضغط على أيقونة القائمة ⋮ في أعلى المتصفح' },
                    { step: 2, text: 'اختر "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية"' },
                    { step: 3, text: 'اتبع الخطوات حتى يظهر أيقونة التطبيق على شاشتك' },
                  ].map(({ step, text }) => (
                    <div key={step} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0 mt-0.5 text-amber-700 dark:text-amber-400 font-black text-sm">
                        {step}
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 text-sm font-medium leading-6">{text}</p>
                    </div>
                  ))
                ) : (
                  [
                    { step: 1, text: 'اضغط على أيقونة التثبيت 📥 في شريط العنوان بجانب الرابط' },
                    { step: 2, text: 'أو من القائمة ⋮ اختر "Install app..." أو "إنشاء اختصار"' },
                    { step: 3, text: 'اضغط "تثبيت" ليظهر التطبيق في قائمة البرامج وسطح المكتب' },
                  ].map(({ step, text }) => (
                    <div key={step} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0 mt-0.5 text-amber-700 dark:text-amber-400 font-black text-sm">
                        {step}
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 text-sm font-medium leading-6">{text}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 flex gap-3 items-start">
                <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-300 font-medium leading-5">
                  بعد التثبيت سيتم فتح النظام كتطبيق أصيل بدون شريط المتصفح، مع إشعارات فورية وتحميل أسرع.
                </p>
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  onClick={handleDismiss}
                  className="flex-1 h-14 rounded-2xl border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 transition-all"
                >
                  ليس الآن
                </button>
                <button
                  onClick={() => setIsVisible(false)}
                  className="flex-1 h-14 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-base shadow-xl shadow-amber-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>فهمت، سأقوم بذلك</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

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
              <p className="text-white/80 text-sm font-medium">استفد من كل مميزات النظام بشكل أسرع</p>
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
                onClick={handleDismiss}
                className="flex-1 h-14 rounded-2xl border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 transition-all"
              >
                ليس الآن
              </button>
              <button
                onClick={handleInstall}
                disabled={isInstalling}
                className="flex-1 h-14 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-base shadow-xl shadow-indigo-600/30 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
