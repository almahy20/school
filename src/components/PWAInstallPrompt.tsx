import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Download, X, Smartphone, CheckCircle2 } from 'lucide-react';

export default function PWAInstallPrompt() {
  const { user } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Check if already in PWA mode
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsStandalone(isPWA);

    // Don't show if already installed
    if (isPWA) {
      setIsVisible(false);
      return;
    }

    // Only show for authenticated users (including pending)
    if (!user) {
      setIsVisible(false);
      return;
    }

    // Check if already shown/installed/dismissed for THIS user
    const storageKey = `pwa_install_${user.id}`;
    const installStatus = localStorage.getItem(storageKey);
    
    // If already shown, installed, or dismissed - don't show again
    if (installStatus === 'shown' || installStatus === 'installed' || installStatus === 'dismissed') {
      setIsVisible(false);
      return;
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      (window as any).deferredPrompt = e;
      console.log('✅ beforeinstallprompt event captured');
      
      // Only auto-show for new users who just signed up
      const signupTime = sessionStorage.getItem('user_signup_time');
      if (signupTime) {
        const timeSinceSignup = Date.now() - parseInt(signupTime);
        // If user signed up in the last 30 seconds, show the prompt
        if (timeSinceSignup < 30000) {
          console.log('🚀 Showing PWA prompt (from event listener)');
          setIsVisible(true);
        }
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if prompt is already available (captured earlier)
    if ((window as any).deferredPrompt) {
      console.log('✅ deferredPrompt already available');
      // Only show for new users who just signed up
      const signupTime = sessionStorage.getItem('user_signup_time');
      if (signupTime) {
        const timeSinceSignup = Date.now() - parseInt(signupTime);
        // If user signed up in the last 30 seconds, show the prompt
        if (timeSinceSignup < 30000) {
          console.log('🚀 Showing PWA prompt (from existing deferredPrompt)');
          setDeferredPrompt((window as any).deferredPrompt);
          setIsVisible(true);
        }
      }
    }

    // FORCE SHOW: For new users who just signed up, always show the prompt
    // even if beforeinstallprompt event hasn't fired yet
    const signupTime = sessionStorage.getItem('user_signup_time');
    if (signupTime) {
      const timeSinceSignup = Date.now() - parseInt(signupTime);
      if (timeSinceSignup < 30000) {
        console.log('🚀 FORCE SHOWING PWA prompt for new user');
        // Wait a bit for user to be fully authenticated
        setTimeout(() => {
          // If we have the deferred prompt, use it
          if ((window as any).deferredPrompt) {
            console.log('✅ Using existing deferredPrompt');
            setDeferredPrompt((window as any).deferredPrompt);
          } else {
            console.log('⚠️ No deferredPrompt available yet, showing modal anyway');
          }
          setIsVisible(true);
        }, 500);
      }
    }

    // Listen for successful installation
    window.addEventListener('appinstalled', () => {
      localStorage.setItem(storageKey, 'installed');
      setDeferredPrompt(null);
      (window as any).deferredPrompt = null;
      setIsStandalone(true);
      setIsVisible(false);
      setIsInstalling(false);
      
      // Clean up signup time
      sessionStorage.removeItem('user_signup_time');
      
      // Reload to open in PWA mode
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [user?.id]);

  const handleInstall = async () => {
    console.log('🔵 handleInstall called');
    console.log('deferredPrompt exists:', !!deferredPrompt);
    console.log('window.deferredPrompt exists:', !!(window as any).deferredPrompt);
    
    // Try MULTIPLE times to get deferredPrompt
    let promptToUse = deferredPrompt;
    
    // Attempt 1: From state
    if (!promptToUse) {
      console.log('⚠️ No deferredPrompt in state, checking window...');
      
      // Attempt 2: From window
      if ((window as any).deferredPrompt) {
        console.log('✅ Getting deferredPrompt from window');
        promptToUse = (window as any).deferredPrompt;
        setDeferredPrompt(promptToUse);
      } else {
        console.log('❌ No deferredPrompt in window either');
        
        // Attempt 3: Wait a bit and check again (sometimes it's delayed)
        console.log('⏳ Waiting 1 second to check again...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if ((window as any).deferredPrompt) {
          console.log('✅ deferredPrompt appeared after waiting!');
          promptToUse = (window as any).deferredPrompt;
          setDeferredPrompt(promptToUse);
        }
      }
    }
    
    if (!promptToUse) {
      console.log('❌ No deferredPrompt available after all attempts - showing manual instructions');
      console.log('This means beforeinstallprompt event never fired');
      console.log('Possible reasons:');
      console.log('  1. First visit to site (need 2 visits)');
      console.log('  2. Not on HTTPS (or localhost)');
      console.log('  3. Service Worker not activated yet');
      console.log('  4. Browser does not support PWA (Firefox, Safari)');
      
      // Manual instructions if native prompt not available
      alert(
        'لتثبيت التطبيق:\n\n' +
        'على الكمبيوتر:\n' +
        '1. اضغط على أيقونة التثبيت في شريط العنوان ←\n' +
        '2. اختر "تثبيت"\n\n' +
        'على الموبايل:\n' +
        '1. اضغط على قائمة المتصفح (⋮) أو مشاركة\n' +
        '2. اختر "Add to Home Screen" أو "إضافة للشاشة الرئيسية"'
      );
      handleDismiss();
      return;
    }

    try {
      console.log('🚀 Triggering native install prompt');
      setIsInstalling(true);
      
      // Trigger native install prompt
      promptToUse.prompt();
      
      const { outcome } = await promptToUse.userChoice;
      
      console.log('User choice outcome:', outcome);
      
      if (outcome === 'accepted') {
        // User accepted - mark as installed
        const storageKey = `pwa_install_${user?.id}`;
        localStorage.setItem(storageKey, 'installed');
        setDeferredPrompt(null);
        (window as any).deferredPrompt = null;
        setIsInstalling(false);
        // The appinstalled event will handle the reload
      } else {
        // User cancelled - mark as dismissed
        handleDismiss();
        setIsInstalling(false);
      }
    } catch (err) {
      console.error('PWA Install error:', err);
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    if (!user) return;
    
    const storageKey = `pwa_install_${user.id}`;
    localStorage.setItem(storageKey, 'dismissed');
    setIsVisible(false);
  };

  // Don't show if not visible, already in PWA mode, or no user
  if (!isVisible || isStandalone || !user) return null;

  console.log('🎉 PWAInstallPrompt is rendering!');

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

          {/* Features */}
          <div className="p-6 space-y-4">
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
