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

  useEffect(() => {
    // Check if dismissed
    if (localStorage.getItem('hide_pwa_onboarding') === 'true') {
      setIsVisible(false);
    }

    // Check if already in PWA mode
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(isPWA);

    // Initial check for existing prompt
    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      (window as any).deferredPrompt = e; // Store globally for other components
      console.log('✅ PWA Install Prompt Available');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    window.addEventListener('appinstalled', () => {
      console.log('🎉 App installed successfully');
      setDeferredPrompt(null);
      (window as any).deferredPrompt = null;
      setIsStandalone(true);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
       console.log('⚠️ No deferred prompt available. Might already be installed or browser unsupported.');
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
        // Refresh to apply changes if needed, but the hook manages state
        setTimeout(() => setIsVisible(false), 2000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('hide_pwa_onboarding', 'true');
    setIsVisible(false);
  };

  // Logic to determine if we should show the overlay
  // Hidden if:
  // 1. Not a parent or teacher
  // 2. Already standalone AND has notification permission
  // 3. Explicitly dismissed
  if (!isVisible) return null;
  if (user?.role !== 'parent' && user?.role !== 'teacher') return null;
  if (isStandalone && permission === 'granted') return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-4 md:p-6 text-right overflow-y-auto" dir="rtl">
      {/* Dynamic Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-lg bg-[#0d121f] border border-white/10 rounded-[48px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden relative animate-in fade-in zoom-in duration-700">
        {/* Banner Image / Design */}
        <div className="h-40 bg-gradient-to-br from-indigo-600 to-indigo-900 relative flex items-end justify-center pb-8 p-8 overflow-hidden">
           <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20" />
           <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="w-20 h-20 rounded-[28px] bg-white shadow-2xl flex items-center justify-center text-indigo-600 mb-2 rotate-3">
                 <Smartphone className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">نظام المتابعة الذكي</h2>
           </div>
           
           <button 
             onClick={handleDismiss}
             className="absolute top-6 left-6 w-10 h-10 rounded-2xl bg-black/20 hover:bg-black/40 text-white/50 hover:text-white flex items-center justify-center transition-all border border-white/5"
           >
             <X className="w-5 h-5" />
           </button>
        </div>

        <div className="p-8 md:p-10 space-y-8">
           <div className="space-y-3 text-center">
              <p className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.2em]">الإعداد النهائي للنظام</p>
              <h1 className="text-xl md:text-2xl font-black text-white leading-tight">يرجى إكمال خطوات التثبيت لضمان وصول التنبيهات</h1>
           </div>

           <div className="space-y-4">
              {/* Step 1: Install PWA */}
              <div className={cn(
                "group relative p-6 rounded-[32px] border transition-all duration-500 flex items-center gap-5",
                isStandalone 
                  ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-500" 
                  : "bg-white/5 border-white/5 text-slate-400"
              )}>
                 <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl transition-transform group-hover:scale-110",
                    isStandalone ? "bg-emerald-500 text-white" : "bg-white/10 text-white/30"
                 )}>
                   {isStandalone ? <CheckCircle className="w-7 h-7" /> : <Download className="w-7 h-7" />}
                 </div>
                 <div className="flex-1 min-w-0">
                    <h3 className={cn("text-base font-black mb-1", isStandalone ? "text-emerald-400" : "text-white")}>تثبيت التطبيق على الجهاز</h3>
                    <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
                       {isStandalone ? 'تم التثبيت بنجاح على جهازك' : 'احصل على تجربة أسرع بنسبة 40% ووصول فوري من الشاشة الرئيسية.'}
                    </p>
                 </div>
                 {!isStandalone && (
                    <Button 
                      onClick={handleInstall} 
                      disabled={!deferredPrompt}
                      className="h-11 px-6 rounded-xl bg-white text-slate-950 hover:bg-slate-200 font-black text-xs shadow-xl active:scale-95 transition-all disabled:opacity-30"
                    >
                       تثبيت
                    </Button>
                 )}
              </div>

              {/* Step 2: Push Notifications */}
              <div className={cn(
                "group relative p-6 rounded-[32px] border transition-all duration-500 flex flex-col gap-4",
                permission === 'granted' 
                  ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-500" 
                  : permission === 'denied'
                  ? "bg-rose-500/5 border-rose-500/20 text-rose-500"
                  : "bg-white/5 border-white/5 text-slate-400"
              )}>
                 <div className="flex items-center gap-5">
                    <div className={cn(
                       "w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl transition-transform group-hover:scale-110",
                       permission === 'granted' ? "bg-emerald-500 text-white" : permission === 'denied' ? "bg-rose-500 text-white" : "bg-indigo-600 text-white"
                    )}>
                      {permission === 'granted' ? <CheckCircle className="w-7 h-7" /> : permission === 'denied' ? <ShieldCheck className="w-7 h-7" /> : <Bell className="w-7 h-7" />}
                    </div>
                    <div className="flex-1 min-w-0">
                       <h3 className={cn("text-base font-black mb-1", permission === 'granted' ? "text-emerald-400" : permission === 'denied' ? "text-rose-400" : "text-white")}>تفعيل الإشعارات الفورية</h3>
                       <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
                          {permission === 'granted' 
                             ? 'الإشعارات مفعلة الآن وتعمل بشكل ممتاز.' 
                             : permission === 'denied'
                             ? 'عذراً، الإشعارات محظورة حالياً من قبل متصفحك.'
                             : 'تلقى إشعارات الغياب، الدرجات، والمصروفات فور صدورها.'}
                       </p>
                    </div>
                    {permission !== 'granted' && permission !== 'denied' && (
                       <Button 
                         onClick={handleNotifications} 
                         disabled={isLoading}
                         className="h-11 px-6 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 font-black text-xs shadow-xl shadow-indigo-600/20 active:scale-95 transition-all"
                       >
                          {isLoading ? 'جاري التفعيل...' : 'تفعيل'}
                       </Button>
                    )}
                 </div>

                 {/* Guide for Denied Permission */}
                 {permission === 'denied' && (
                    <div className="mt-2 p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                       <p className="text-[10px] font-black text-white/60">💡 كيفية إعادة تفعيل الإشعارات:</p>
                       <ul className="space-y-2 text-[10px] font-bold text-slate-400 leading-relaxed list-decimal list-inside pr-2">
                          <li>انقر على أيقونة الإعدادات/القفل بجانب رابط الموقع في أعلى المتصفح.</li>
                          <li>ابحث عن حقل "الإشعارات" (Notifications).</li>
                          <li>قم بتغيير الحالة من "حظر" إلى "سماح".</li>
                          <li>قم بتحديث الصفحة للمتابعة.</li>
                       </ul>
                       <Button 
                         onClick={() => window.location.reload()}
                         className="w-full h-9 rounded-xl bg-white/5 hover:bg-white/10 text-white font-black text-[10px] border border-white/10"
                       >
                          تحديث الصفحة بعد التعديل
                       </Button>
                    </div>
                 )}
              </div>
           </div>

           <div className="p-6 rounded-[32px] bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-4">
              <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                 <p className="text-xs font-black text-indigo-300">أمن وخصوصية بياناتك</p>
                 <p className="text-[10px] font-bold text-slate-500 leading-relaxed">
                    نحن نستخدم تقنيات التشفير المتقدمة لنقل الإشعارات. تفعيل هذه الخصائص يضمن لك البقاء على اطلاع دائم بمسيرة أبنائك التعليمية بأمان تام.
                 </p>
              </div>
           </div>
        </div>

        {/* Footer Info */}
        <div className="bg-white/5 p-6 text-center border-t border-white/5">
           <button onClick={handleDismiss} className="text-[10px] font-black text-slate-500 hover:text-white transition-colors uppercase tracking-[0.2em]">
              رُبما لاحقاً، أريد المتابعة بدون إشعارات
           </button>
        </div>
      </div>
    </div>
  );
}
