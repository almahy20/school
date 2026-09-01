import { useEffect, useState } from 'react';
import { Download, Smartphone, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { IOSPwaGuideModal } from '@/components/IOSPwaGuideModal';

// iOS detection — لا يطلق beforeinstallprompt أبداً
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
const isIOSStandalone = (window.navigator as any).standalone === true;

export default function PWAInstallPrompt() {
  const { user } = useAuth();
  const { canInstall, isStandalone, promptInstall } = usePWAInstall();
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (isStandalone || isIOSStandalone || !user) {
      setIsVisible(false);
      return;
    }

    // على iOS: لا يوجد beforeinstallprompt — اعرض دليل يدوي
    if (isIOS && !isIOSStandalone) {
      setIsVisible(localStorage.getItem(`pwa_install_${user.id}`) !== 'installed');
      return;
    }

    if (!canInstall) {
      setIsVisible(false);
      return;
    }

    setIsVisible(localStorage.getItem(`pwa_install_${user.id}`) !== 'installed');
  }, [user, canInstall, isStandalone]);

  const handleInstall = async () => {
    setIsInstalling(true);
    const result = await promptInstall();
    setIsInstalling(false);

    if (result === 'accepted') {
      if (user) localStorage.setItem(`pwa_install_${user.id}`, 'installed');
      setIsVisible(false);
      return;
    }

    // لا يبقى الموقع مقفولًا إذا رفض المستخدم النافذة أو لم يستجب المتصفح.
    setIsVisible(false);
  };

  const handleDismiss = () => {
    if (user) localStorage.setItem(`pwa_install_${user.id}`, 'installed');
    setIsVisible(false);
    setShowIOSGuide(false);
  };

  // حالة iOS — اعرض دليل Add to Home Screen
  if (isIOS && !isIOSStandalone && isVisible && user) {
    return (
      <IOSPwaGuideModal
        open={showIOSGuide || isVisible}
        onClose={handleDismiss}
      />
    );
  }

  if (!isVisible || isStandalone || !user) return null;

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

            <button
              onClick={handleInstall}
              disabled={isInstalling}
              className="w-full h-14 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-base shadow-xl shadow-indigo-600/30 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3 mt-6"
            >
              {isInstalling ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>جاري التثبيت...</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>تثبيت التطبيق</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
