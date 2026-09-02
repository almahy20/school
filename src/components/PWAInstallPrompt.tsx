import { useEffect, useState, useCallback } from 'react';
import { Download, Smartphone, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { IOSPwaGuideModal } from '@/components/IOSPwaGuideModal';

// يُحفظ فقط عند التثبيت الفعلي
const INSTALLED_KEY = 'pwa_installed';
// مفتاح تأجيل "ليس الآن" — يُعرض مرة واحدة كل 3 أيام
const SNOOZED_KEY = 'pwa_install_snoozed_until';

// iOS detection
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

export default function PWAInstallPrompt() {
  const { canInstall, isStandalone, promptInstall } = usePWAInstall();
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const checkAndShow = useCallback(() => {
    // لو التطبيق مثبت بالفعل (standalone mode) → لا تظهر
    if (isStandalone) return;

    // لو ثبّت المستخدم التطبيق من قبل → لا تظهر أبداً
    if (localStorage.getItem(INSTALLED_KEY) === '1') return;

    // لو المستخدم أجّل → تحقق هل انتهى وقت التأجيل
    const snoozedUntil = Number(localStorage.getItem(SNOOZED_KEY) ?? 0);
    if (snoozedUntil && Date.now() < snoozedUntil) return;

    // iOS: دليل يدوي دائماً
    if (isIOS) { setIsVisible(true); return; }

    // Android/Chrome: فقط لو الـ prompt متاح
    const prompt = (window as any).deferredPrompt;
    if (prompt) { setIsVisible(true); }
  }, [isStandalone]);

  useEffect(() => {
    // فحص فوري
    checkAndShow();

    // فحص بعد 3 ثواني (بعض الأجهزة تُطلق الحدث متأخراً)
    const t1 = setTimeout(checkAndShow, 3000);
    // فحص بعد 8 ثواني كـ fallback نهائي
    const t2 = setTimeout(checkAndShow, 8000);

    // فحص عند عودة المستخدم للتبويب
    const onFocus = () => checkAndShow();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [checkAndShow]);

  // إعادة الفحص عند تغير canInstall (لما يطلق beforeinstallprompt)
  useEffect(() => {
    if (canInstall) checkAndShow();
  }, [canInstall, checkAndShow]);

  // "ليس الآن" → أجّل 3 أيام
  const handleDismiss = () => {
    localStorage.setItem(SNOOZED_KEY, String(Date.now() + 3 * 24 * 60 * 60 * 1000));
    setIsVisible(false);
  };

  const handleInstall = async () => {
    setIsInstalling(true);
    const result = await promptInstall();
    setIsInstalling(false);

    if (result === 'accepted') {
      localStorage.setItem(INSTALLED_KEY, '1');
    }
    setIsVisible(false);
  };

  if (!isVisible || isStandalone) return null;

  // iOS: دليل يدوي
  if (isIOS) {
    return (
      <IOSPwaGuideModal
        open={isVisible}
        onClose={handleDismiss}
      />
    );
  }

  // Android/Chrome: نافذة التثبيت العادية
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
