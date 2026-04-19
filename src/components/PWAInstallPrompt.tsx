import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

export default function PWAInstallPrompt() {
  const { user } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    console.log('🔍 PWA Install: useEffect triggered, user:', user?.id, 'role:', user?.role);
    
    // Check if already in PWA mode
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsStandalone(isPWA);

    // Don't show if already installed
    if (isPWA) {
      console.log('❌ PWA Install: Already in PWA mode');
      setIsVisible(false);
      return;
    }

    // Check if dismissed for THIS user (use userId in key)
    const storageKey = user?.id ? `pwa_install_dismissed_${user.id}` : 'pwa_install_dismissed';
    if (localStorage.getItem(storageKey) === 'true') {
      console.log('❌ PWA Install: Previously dismissed for this user');
      setIsVisible(false);
      return;
    }

    // Only show for parents, teachers, and admins (including pending)
    const allowedRoles = ['parent', 'teacher', 'admin', 'pending'];
    if (!user || !allowedRoles.includes(user.role)) {
      console.log('❌ PWA Install: User role not allowed:', user?.role);
      setIsVisible(false);
      return;
    }

    console.log('✅ PWA Install: Showing for role:', user.role);

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      console.log('✅ PWA Install Prompt Captured!');
      setDeferredPrompt(e);
      (window as any).deferredPrompt = e;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if prompt is already available
    const checkInterval = setInterval(() => {
      if ((window as any).deferredPrompt) {
        setDeferredPrompt((window as any).deferredPrompt);
        clearInterval(checkInterval);
      }
    }, 500);

    // Listen for successful installation
    window.addEventListener('appinstalled', () => {
      console.log('🎉 App installed successfully');
      setDeferredPrompt(null);
      (window as any).deferredPrompt = null;
      setIsStandalone(true);
      
      setTimeout(() => {
        setIsVisible(false);
        window.location.reload();
      }, 500);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearInterval(checkInterval);
    };
  }, [user?.role, user?.id]);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      console.log('⚠️ PWA Install: No deferred prompt available');
      alert('لتثبيت التطبيق:\n1. اضغط على قائمة المتصفح (⋮)\n2. اختر "Install" أو "تثبيت"');
      return;
    }

    try {
      console.log('🚀 PWA Install: Triggering native install prompt');
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('✅ PWA Install: User accepted');
        setDeferredPrompt(null);
      } else {
        console.log('❌ PWA Install: User cancelled');
      }
    } catch (err) {
      console.error('❌ PWA Install error:', err);
    }
  };

  const handleDismiss = () => {
    // Save with userId so it's per-user
    const storageKey = user?.id ? `pwa_install_dismissed_${user.id}` : 'pwa_install_dismissed';
    localStorage.setItem(storageKey, 'true');
    setIsVisible(false);
  };

  if (!isVisible || isStandalone) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:bottom-8 z-[9999]" dir="rtl">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 max-w-sm mx-auto md:mx-0 animate-in slide-in-from-bottom-5">
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 left-3 w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>

        {/* Content */}
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg">
            <Download className="w-8 h-8 text-white" />
          </div>

          <div>
            <h3 className="text-lg font-black text-slate-900 mb-1">ثبت التطبيق على جهازك</h3>
            <p className="text-sm text-slate-600">افتح التطبيق بسرعة من الشاشة الرئيسية</p>
          </div>

          {/* Install Button */}
          <Button
            onClick={handleInstall}
            disabled={!deferredPrompt}
            className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Download className="w-5 h-5 ml-2" />
            {deferredPrompt ? 'تثبيت الآن' : 'جاري التحميل...'}
          </Button>

          {/* Skip Link */}
          <button
            onClick={handleDismiss}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            ليس الآن
          </button>
        </div>
      </div>
    </div>
  );
}
