import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/utils/logger';
import { Download, X, Smartphone, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';

export default function PWAInstallPrompt() {
  const { user } = useAuth();
  const { canInstall, isStandalone, promptInstall } = usePWAInstall();
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    if (isStandalone || !user) { setIsVisible(false); return; }

    const storageKey = `pwa_install_${user.id}`;
    if (localStorage.getItem(storageKey) === 'installed') { setIsVisible(false); return; }

    const lastDismissed = localStorage.getItem(`${storageKey}_dismissed_at`);
    if (lastDismissed && Date.now() - parseInt(lastDismissed) < 7 * 24 * 60 * 60 * 1000) {
      setIsVisible(false);
      return;
    }

    if (canInstall) {
      setIsVisible(true);
      return;
    }

    // Safari / iOS — عرض تعليمات يدوية بعد 5 ثواني
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if ((isIOS || isSafari) && !isStandalone) {
      const timer = setTimeout(() => setIsVisible(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [user, canInstall, isStandalone]);

  // اظهار التلقائي لما يتوفر الـ prompt
  useEffect(() => {
    if (canInstall && user && !isStandalone) {
      const storageKey = `pwa_install_${user.id}`;
      const isDismissedRecently = (() => {
        const t = localStorage.getItem(`${storageKey}_dismissed_at`);
        return t ? Date.now() - parseInt(t) < 7 * 24 * 60 * 60 * 1000 : false;
      })();
      if (!isDismissedRecently && localStorage.getItem(storageKey) !== 'installed') {
        setIsVisible(true);
      }
    }
  }, [canInstall, user, isStandalone]);

  const handleInstall = async () => {
    setIsInstalling(true);
    const result = await promptInstall();
    setIsInstalling(false);

    if (result === 'accepted') {
      if (user) localStorage.setItem(`pwa_install_${user.id}`, 'installed');
      setIsVisible(false);
    } else if (result === 'dismissed') {
      handleDismiss();
    } else {
      // unavailable — عرض تعليمات يدوية
      setShowManual(true);
    }
  };

  const handleDismiss = () => {
    if (!user) return;
    localStorage.setItem(`pwa_install_${user.id}_dismissed_at`, Date.now().toString());
    setIsVisible(false);
  };

  if (!isVisible || isStandalone || !user) return null;

  logger.log('🎉 PWAInstallPrompt is rendering!');

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] animate-in fade-in duration-300"
        onClick={handleDismiss}
      />
      
      {/* Modal */}
      <div 
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300"
        onClick={handleDismiss}
      >
        <div 
          className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          dir="rtl"
        >
          {/* Header with gradient */}
          <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-8 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.1),transparent)]" />
            
            <button
              onClick={handleDismiss}
              className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            <div className="relative z-10">
              <div className="w-20 h-20 mx-auto bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mb-4 shadow-xl">
                <Smartphone className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">
                ثبت التطبيق الآن
              </h2>
              <p className="text-white/80 text-sm font-medium">
                استفد من كل مميزات النظام بشكل أسرع
              </p>
            </div>
          </div>

          {/* Features or Manual Instructions */}
          <div className="p-6 space-y-4">
            {!showManual ? (
              <>
                <div className="space-y-3">
                  {[
                    { icon: CheckCircle2, text: 'فتح سريع بضغطة واحدة من الشاشة الرئيسية' },
                    { icon: CheckCircle2, text: 'إشعارات فورية حتى لو التطبيق مغلق' },
                    { icon: CheckCircle2, text: 'تجربة تطبيق أصيل بدون متصفح' },
                    { icon: CheckCircle2, text: 'أداء أفضل واستهلاك أقل للإنترنت' },
                  ].map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <feature.icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 text-sm font-medium">
                        {feature.text}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Install Button */}
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
              </>
            ) : (
              <div className="space-y-6 py-2">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl space-y-4 border border-slate-100 dark:border-slate-800">
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs">1</span>
                    على أجهزة iPhone / iPad (Safari)
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pr-8">
                    اضغط على زر <span className="font-bold text-indigo-600">"مشاركة" (Share)</span> في أسفل المتصفح، ثم اختر <span className="font-bold text-indigo-600">"إضافة للشاشة الرئيسية" (Add to Home Screen)</span>.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl space-y-4 border border-slate-100 dark:border-slate-800">
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs">2</span>
                    على أجهزة Android (Chrome)
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pr-8">
                    اضغط على زر <span className="font-bold text-indigo-600">القائمة (⋮)</span>، ثم اختر <span className="font-bold text-indigo-600">"تثبيت التطبيق"</span> أو <span className="font-bold text-indigo-600">"Add to Home Screen"</span>.
                  </p>
                </div>

                <button
                  onClick={() => setShowManual(false)}
                  className="w-full h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm transition-colors mt-2"
                >
                  العودة للخلف
                </button>
              </div>
            )}

            {/* Maybe Later */}
            <button
              onClick={handleDismiss}
              className="w-full h-12 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-bold text-sm transition-colors"
            >
              ليس الآن
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
