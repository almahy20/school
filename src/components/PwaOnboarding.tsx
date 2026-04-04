import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Download, Bell, ShieldCheck, Smartphone, CheckCircle, Info } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { cn } from '@/lib/utils';

export default function PwaOnboarding() {
  const { user } = useAuth();
  const { permission, subscribeToNotifications } = usePushNotifications();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    // Check if already in PWA mode
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(isPWA);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setStep(2);
    }
  };

  const handleNotifications = async () => {
    const success = await subscribeToNotifications();
    if (success) {
      // Completed onboarding
      window.location.reload();
    }
  };

  // Only show for parents who haven't completed onboarding
  // If they are already in PWA and have notification permission, don't show
  if (user?.role !== 'parent') return null;
  if (isStandalone && permission === 'granted') return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-[#060b16] flex flex-col items-center justify-center p-6 text-right overflow-hidden" dir="rtl">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.05] pointer-events-none" />
      
      <div className="w-full max-w-md bg-white rounded-[48px] shadow-2xl p-10 relative overflow-hidden animate-in fade-in zoom-in duration-700">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-bl-[120px]" />
        
        <div className="flex flex-col items-center text-center space-y-8 relative z-10">
          <div className="w-24 h-24 rounded-[32px] bg-slate-900 flex items-center justify-center text-white shadow-2xl rotate-3">
            <Smartphone className="w-12 h-12" />
          </div>

          <div className="space-y-3">
             <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">تفعيل المتابعة الذكية</h1>
             <p className="text-slate-500 font-medium leading-relaxed">
               لضمان استلام تنبيهات الدرجات، الغياب، والمصروفات فوراً، يرجى إكمال الخطوات التالية:
             </p>
          </div>

          <div className="w-full space-y-4">
             {/* Step 1: Install App */}
             <div className={cn(
               "p-6 rounded-[32px] border-2 transition-all duration-500 flex items-center gap-6",
               isStandalone ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-slate-50 border-slate-100 text-slate-400"
             )}>
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm",
                  isStandalone ? "bg-white text-emerald-500" : "bg-white text-slate-300"
                )}>
                  {isStandalone ? <CheckCircle className="w-6 h-6" /> : <Download className="w-6 h-6" />}
                </div>
                <div className="flex-1 text-right">
                   <h3 className="text-sm font-black text-slate-900">تثبيت التطبيق على الجهاز</h3>
                   <p className="text-[10px] font-bold opacity-60">احصل على وصول سريع ومستقر للمنصة.</p>
                </div>
                {!isStandalone && deferredPrompt && (
                   <Button onClick={handleInstall} className="h-10 px-5 rounded-xl bg-slate-900 text-white font-black text-[10px] gap-2">
                      تثبيت الآن
                   </Button>
                )}
             </div>

             {/* Step 2: Enable Notifications */}
             <div className={cn(
               "p-6 rounded-[32px] border-2 transition-all duration-500 flex items-center gap-6",
               permission === 'granted' ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-slate-50 border-slate-100 text-slate-400"
             )}>
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm",
                  permission === 'granted' ? "bg-white text-emerald-500" : "bg-white text-slate-300"
                )}>
                  {permission === 'granted' ? <CheckCircle className="w-6 h-6" /> : <Bell className="w-6 h-6" />}
                </div>
                <div className="flex-1 text-right">
                   <h3 className="text-sm font-black text-slate-900">تفعيل الإشعارات الفورية</h3>
                   <p className="text-[10px] font-bold opacity-60">تلقى تحديثات الأبناء لحظة بلحظة.</p>
                </div>
                {permission !== 'granted' && (
                   <Button onClick={handleNotifications} className="h-10 px-5 rounded-xl bg-indigo-600 text-white font-black text-[10px] gap-2 shadow-lg shadow-indigo-200">
                      تفعيل
                   </Button>
                )}
             </div>
          </div>

          <div className="w-full p-5 rounded-[24px] bg-amber-50 border border-amber-100 flex items-start gap-4 text-right">
             <Info className="w-5 h-5 text-amber-500 shrink-0 mt-1" />
             <p className="text-[10px] font-bold text-amber-700 leading-relaxed">
               ملاحظة: هذه الخطوات ضرورية لضمان عمل حسابك بشكل صحيح وتلقي التنبيهات الرسمية من إدارة المدرسة.
             </p>
          </div>
        </div>
      </div>
      
      <p className="mt-8 text-[10px] font-black text-white/30 uppercase tracking-widest">إدارة عربية • نظام المتابعة الذكي للأهالي</p>
    </div>
  );
}
