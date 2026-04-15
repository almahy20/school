import { useState, useEffect } from 'react';
import { Download, PlusSquare, Share, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showAndroid, setShowAndroid] = useState(false);
  const [showIos, setShowIos] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Detect iOS
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

    if (isIos && !isStandalone) {
      const dismissed = localStorage.getItem('pwa-dismissed-ios');
      if (!dismissed) setShowIos(true);
    }

    // Capture Android prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const dismissed = localStorage.getItem('pwa-dismissed-android');
      if (!dismissed) setShowAndroid(true);
    });
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowAndroid(false);
    }
  };

  const dismiss = (type: 'android' | 'ios') => {
    localStorage.setItem(`pwa-dismissed-${type}`, 'true');
    if (type === 'android') setShowAndroid(false);
    else setShowIos(false);
  };

  if (isDismissed) return null;

  return (
    <>
      {/* Android Install Prompt Overlay */}
      {showAndroid && (
        <div className="fixed bottom-24 left-4 right-4 z-[9999] animate-in slide-in-from-bottom-10 flex flex-col items-center">
          <div className="w-full max-w-sm bg-slate-900 text-white rounded-[32px] p-6 shadow-2xl border border-white/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
            <button 
              onClick={() => dismiss('android')}
              className="absolute top-4 left-4 p-2 rounded-full hover:bg-white/10 text-white/40 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10">
                <Download className="w-7 h-7 text-indigo-400" />
              </div>
              <div className="text-right">
                <h3 className="text-base font-black">تثبيت التطبيق</h3>
                <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest">تحميل نسخة الموبايل الرسمية</p>
              </div>
            </div>
            <Button 
              onClick={handleInstallClick}
              className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm shadow-xl shadow-indigo-900/50 transition-all active:scale-95"
            >
              استخدام نسخة التطبيق الآن
            </Button>
          </div>
        </div>
      )}

      {/* iOS Install Prompt (Visual Guide) */}
      {showIos && (
        <div className="fixed bottom-24 left-4 right-4 z-[9999] animate-in slide-in-from-bottom-10 flex flex-col items-center">
          <div className="w-full max-w-sm bg-white rounded-[32px] p-6 shadow-2xl border border-slate-100 relative overflow-hidden">
            <button 
              onClick={() => dismiss('ios')}
              className="absolute top-4 left-4 p-2 rounded-full hover:bg-slate-50 text-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-[40px] bg-slate-50 flex items-center justify-center text-indigo-600 shadow-inner border border-slate-100 mb-2">
                <PlusSquare className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900">تثبيت على الأيفون</h3>
                <p className="text-[11px] text-slate-400 font-bold">اتبع هذه الخطوات البسيطة للتثبيت</p>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full mt-4">
                 <div className="p-4 rounded-3xl bg-slate-50 border border-slate-100 flex flex-col items-center gap-3">
                    <Share className="w-5 h-5 text-indigo-500" />
                    <p className="text-[10px] font-black text-slate-600 leading-tight">اضغط على زر المشاركة أرسل</p>
                 </div>
                 <div className="p-4 rounded-3xl bg-slate-50 border border-slate-100 flex flex-col items-center gap-3">
                    <PlusSquare className="w-5 h-5 text-emerald-500" />
                    <p className="text-[10px] font-black text-slate-600 leading-tight">اختر "إضافة لشاشة الرئيسية"</p>
                 </div>
              </div>

              <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-4">استمتع بتجربة تطبيق كاملة</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
