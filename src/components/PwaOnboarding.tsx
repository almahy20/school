import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Download, Bell, ShieldCheck, Smartphone, CheckCircle, Info, X } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { cn } from '@/lib/utils';

export default function PwaOnboarding() {
  const { user } = useAuth();
  const { permission, subscribeToNotifications } = usePushNotifications();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isSafari, setIsSafari] = useState(false);

  useEffect(() => {
    // Check for iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    setIsIOS(isIOSDevice);
    setIsSafari(isSafariBrowser);

    // Check if dismissed - NOW SHOWS ONLY ONCE EVER
    if (localStorage.getItem('hide_pwa_onboarding') === 'true') {
      setIsVisible(false);
      return;
    }

    // Check if already in PWA mode
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsStandalone(isPWA);

    // If already installed and notifications granted, don't show
    if (isPWA && (permission === 'granted' || permission === 'denied')) {
      localStorage.setItem('hide_pwa_onboarding', 'true');
      setIsVisible(false);
      return;
    }

    // Only show once per session - if they dismissed before, don't show again
    const sessionShown = sessionStorage.getItem('pwa_onboarding_shown');
    if (sessionShown === 'true') {
      setIsVisible(false);
      return;
    }

    // Initial check for existing prompt (Chrome/Edge only)
    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      (window as any).deferredPrompt = e; 
      console.log('✅ PWA Install Prompt Available');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    window.addEventListener('appinstalled', () => {
      console.log('🎉 App installed successfully');
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
    if (!deferredPrompt) {
       // On Safari, this button shouldn't even be the primary action if not supported
       return;
    }
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsStandalone(true);
      }
    } catch (err) {
      console.error('❌ Install Error:', err);
    }
  };

  const handleNotifications = async () => {
    setIsLoading(true);
    try {
      const success = await subscribeToNotifications();
      if (success) {
        setTimeout(() => setIsVisible(false), 2000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    // Permanently dismiss - never show again
    localStorage.setItem('hide_pwa_onboarding', 'true');
    sessionStorage.setItem('pwa_onboarding_shown', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;
  if (!user) return null;
  
  // Only show for parents and teachers
  if (user?.role !== 'parent' && user?.role !== 'teacher') return null;
  
  // If already standalone (installed) and notifications granted, never show
  if (isStandalone && permission === 'granted') return null;

  return (
    // Small non-intrusive banner at bottom
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[9999] animate-in slide-in-from-bottom-10 fade-in duration-500" dir="rtl">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header with close button */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">تحسين تجربتك</h3>
              <p className="text-xs text-slate-500">خطوات بسيطة لأفضل أداء</p>
            </div>
          </div>
          <button 
            onClick={handleDismiss}
            className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Step 1: Install */}
          {!isStandalone && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-slate-600 shrink-0">
                <Download className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-700">تثبيت التطبيق</p>
                {deferredPrompt ? (
                  <Button 
                    onClick={handleInstall} 
                    className="h-7 px-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 font-bold text-[10px] mt-1"
                  >
                    تثبيت الآن
                  </Button>
                ) : isIOS ? (
                  <p className="text-[10px] text-slate-500">اضغط مشاركة ← إضافة للشاشة الرئيسية</p>
                ) : (
                  <p className="text-[10px] text-slate-500">استخدم قائمة المتصفح للتثبيت</p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Notifications */}
          {permission !== 'granted' && permission !== 'denied' && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-indigo-600 shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-700">تفعيل الإشعارات</p>
                <p className="text-[10px] text-slate-500 mb-1">تنبيهات الغياب والدرجات فوراً</p>
                <Button 
                  onClick={handleNotifications} 
                  disabled={isLoading}
                  className="h-7 px-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 font-bold text-[10px]"
                >
                  {isLoading ? 'جاري...' : 'تفعيل'}
                </Button>
              </div>
            </div>
          )}

          {isStandalone && permission === 'granted' && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50">
              <CheckCircle className="w-8 h-8 text-emerald-600 shrink-0" />
              <p className="text-xs font-bold text-emerald-700">تم الإعداد بنجاح! 🎉</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-3">
          <button 
            onClick={handleDismiss} 
            className="w-full text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors py-2"
          >
            ربما لاحقاً
          </button>
        </div>
      </div>
    </div>
  );
}
