import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Download, Bell, Smartphone, X, Share, PlusSquare } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function PwaOnboarding() {
  const { user } = useAuth();
  const { permission, subscribeToNotifications } = usePushNotifications();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check for iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);

    // Completely hide if permanently dismissed
    if (localStorage.getItem('hide_pwa_onboarding') === 'true') {
      setIsVisible(false);
      return;
    }

    // Check if already in PWA mode
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsStandalone(isPWA);

    if (isPWA && (permission === 'granted' || permission === 'denied')) {
      localStorage.setItem('hide_pwa_onboarding', 'true');
      setIsVisible(false);
      return;
    }

    // Session cache to not annoy on every refresh
    if (sessionStorage.getItem('pwa_onboarding_shown') === 'true') {
      setIsVisible(false);
      return;
    }

    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      (window as any).deferredPrompt = e; 
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      (window as any).deferredPrompt = null;
      setIsStandalone(true);
      localStorage.setItem('hide_pwa_onboarding', 'true');
      setIsVisible(false);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [permission]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsStandalone(true);
      }
    } catch (err) {
      console.error('Install Error:', err);
    }
  };

  const handleNotifications = async () => {
    setIsLoading(true);
    try {
      const success = await subscribeToNotifications();
      if (success && isStandalone) {
        setTimeout(() => setIsVisible(false), 2000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem('pwa_onboarding_shown', 'true');
    setIsVisible(false);
  };

  const handlePermanentDismiss = () => {
    localStorage.setItem('hide_pwa_onboarding', 'true');
    setIsVisible(false);
  };

  if (!isVisible || !user) return null;
  if (user?.role !== 'parent' && user?.role !== 'teacher') return null;
  if (isStandalone && permission === 'granted') return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-500" dir="rtl">
      <div className="bg-white max-w-sm w-full rounded-[40px] shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-500">
        
        {/* Header Background */}
        <div className="h-32 bg-indigo-600 relative overflow-hidden flex items-center justify-center">
           <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
           <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-900/40 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
           
           <div className="w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center relative z-10 rotate-3">
              <Smartphone className="w-8 h-8 text-indigo-600" />
           </div>
           
           <button 
             onClick={handleDismiss}
             className="absolute top-4 right-4 w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white backdrop-blur-md transition-all z-20"
           >
             <X className="w-4 h-4" />
           </button>
        </div>

        <div className="p-8 text-center">
          <h2 className="text-2xl font-black text-slate-900 mb-2">ثبّت التطبيق الآن</h2>
          <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed">
            للحصول على أفضل تجربة، وسرعة في التصفح، وإشعارات فورية بالدرجات والغياب.
          </p>

          <div className="space-y-4 text-right">
            {/* INSTALL APP SECTION */}
            {!isStandalone && (
              <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
                    <Download className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-base">إضافة للشاشة الرئيسية</h3>
                    <p className="text-xs text-slate-400 font-bold">بضغطة زر واحدة فقط</p>
                  </div>
                </div>

                {deferredPrompt ? (
                  <Button 
                    onClick={handleInstall} 
                    className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-600/20 text-sm gap-2"
                  >
                    <Download className="w-4 h-4" /> تثبيت التطبيق الآن
                  </Button>
                ) : isIOS ? (
                  <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50 space-y-3">
                    <p className="text-xs font-bold text-indigo-900 text-center">خطوات التثبيت للآيفون (iOS)</p>
                    <div className="flex items-center justify-center gap-3 text-indigo-600 text-[11px] font-black">
                      <div className="flex flex-col items-center gap-1">
                        <Share className="w-6 h-6 p-1 bg-white rounded-md shadow-sm" />
                        <span>مشاركة</span>
                      </div>
                      <span className="text-indigo-300">←</span>
                      <div className="flex flex-col items-center gap-1">
                        <PlusSquare className="w-6 h-6 p-1 bg-white rounded-md shadow-sm" />
                        <span>إضافة للشاشة</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs font-bold text-slate-500 text-center bg-white p-3 rounded-xl border border-slate-100">
                    استخدم زر القائمة في متصفحك (⋮) ثم اختر "تثبيت التطبيق" أو "إضافة للشاشة الرئيسية"
                  </p>
                )}
              </div>
            )}

            {/* NOTIFICATIONS SECTION */}
            {permission !== 'granted' && permission !== 'denied' && (
              <div className="bg-emerald-50 p-5 rounded-3xl border border-emerald-100 flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
                    <Bell className="w-6 h-6 text-emerald-600 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-base">تفعيل الإشعارات</h3>
                    <p className="text-xs text-slate-500 font-bold">تنبيهات لحظية بالمستجدات</p>
                  </div>
                </div>
                <Button 
                  onClick={handleNotifications} 
                  disabled={isLoading}
                  className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-lg shadow-emerald-600/20 text-sm gap-2"
                >
                  <Bell className="w-4 h-4" /> {isLoading ? 'جاري التفعيل...' : 'السماح بالإشعارات'}
                </Button>
              </div>
            )}
          </div>

          <button 
            onClick={handlePermanentDismiss}
            className="mt-6 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
          >
            لا أريد التثبيت، سأستمر من المتصفح
          </button>
        </div>
      </div>
    </div>
  );
}
