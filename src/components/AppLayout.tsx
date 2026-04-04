import { useState, ReactNode, useMemo, useEffect } from 'react';
import Sidebar from './Sidebar';
import { Menu, BookOpen, Bell, Search, User, ChevronLeft, ShieldAlert, Smartphone, CheckCircle2, Zap } from 'lucide-react';
import { GlobalAnnouncement } from './GlobalAnnouncement';
import BottomNav from './layout/BottomNav';
import PWAInstallPrompt from './PWAInstallPrompt';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';

interface Props {
  children: ReactNode;
}

function MandatoryNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isSubscribed, subscribeToNotifications, permission } = usePushNotifications();
  const [show, setShow] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [backgroundAllowed, setBackgroundAllowed] = useState(false);
  
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  useEffect(() => {
    // Check if Periodic Sync is available/allowed (a proxy for background work)
    if ('periodicSync' in navigator) {
      (navigator as any).permissions.query({ name: 'periodic-background-sync' }).then((status: any) => {
        setBackgroundAllowed(status.state === 'granted');
      });
    } else {
      // If not supported, we assume true if PWA is installed to not block
      setBackgroundAllowed(true);
    }
  }, []);

  useEffect(() => {
    // Frequently check for the global prompt
    const checkPrompt = setInterval(() => {
      if ((window as any).deferredPrompt) {
        setCanInstall(true);
        clearInterval(checkPrompt);
      }
    }, 500);

    // Also listen for the event in case it fires while component is mounted
    const handler = (e: any) => {
      console.log('✅ PWA Install Prompt Captured in Component');
      e.preventDefault();
      (window as any).deferredPrompt = e;
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      console.log('🎉 App installed successfully');
      (window as any).deferredPrompt = null;
      setCanInstall(false);
      window.location.reload();
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearInterval(checkPrompt);
    };
  }, [isPWA]);

  useEffect(() => {
    if (user && (!isSubscribed || !isPWA || (isPWA && !backgroundAllowed))) {
      const timer = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [user, isSubscribed, isPWA, backgroundAllowed]);

  const handleInstall = async () => {
    const promptEvent = (window as any).deferredPrompt;
    if (promptEvent) {
      try {
        promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        console.log(`User response to install: ${outcome}`);
        if (outcome === 'accepted') {
          (window as any).deferredPrompt = null;
          setCanInstall(false);
        }
      } catch (err) {
        console.error('Error during installation:', err);
      }
    } else {
      // Fallback: If no prompt is available, show manual instructions
      toast({ 
        title: "التثبيت اليدوي مطلوب", 
        description: "يرجى الضغط على النقاط الثلاث في المتصفح واختيار 'تثبيت التطبيق' أو 'إضافة للشاشة الرئيسية'.",
        duration: 6000
      });
    }
  };

  const handleBackgroundEnable = async () => {
    if ('periodicSync' in navigator) {
      try {
        const status = await (navigator as any).permissions.query({ name: 'periodic-background-sync' });
        if (status.state === 'granted') {
          setBackgroundAllowed(true);
        } else {
          toast({ title: "مطلوب", description: "يرجى السماح بالعمل في الخلفية من إعدادات المتصفح" });
        }
      } catch (e) {
        setBackgroundAllowed(true);
      }
    } else {
      setBackgroundAllowed(true);
    }
  };

  if (!show || (isSubscribed && isPWA && backgroundAllowed)) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[9999] flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
      <div className="max-w-md w-full bg-white rounded-[40px] p-6 md:p-8 shadow-2xl animate-in zoom-in-95 duration-500 relative my-auto border border-slate-100">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500" />
        
        <div className="text-center mb-6 pt-2">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
            <ShieldAlert className="w-8 h-8 animate-pulse" />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2 tracking-tight">تفعيل قوى النظام الذكي</h2>
          <p className="text-slate-500 font-medium text-[10px] leading-relaxed max-w-[260px] mx-auto">
            لضمان وصول الإشعارات الفورية حتى والتطبيق مغلق، يرجى استكمال الخطوات التالية:
          </p>
        </div>

        <div className="space-y-3">
          {/* Step 1: PWA Installation */}
          <div className={cn(
            "p-4 rounded-3xl border-2 transition-all duration-500",
            isPWA ? "bg-emerald-50 border-emerald-100" : "bg-slate-50 border-slate-100"
          )}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-colors duration-500",
                  isPWA ? "bg-emerald-500 text-white" : "bg-white text-slate-400"
                )}>
                  {isPWA ? <CheckCircle2 className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                </div>
                <div className="text-right">
                  <p className={cn("text-xs font-black mb-0.5", isPWA ? "text-emerald-700" : "text-slate-900")}>تثبيت النظام</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">الخطوة الأولى والأساسية</p>
                </div>
              </div>
              {!isPWA && (
                <Button 
                  onClick={isIOS ? undefined : handleInstall}
                  className="h-9 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] shadow-lg shadow-indigo-100"
                >
                  {canInstall ? 'تثبيت الآن' : 'بدء التثبيت'}
                </Button>
              )}
            </div>
            {!isPWA && !canInstall && !isIOS && (
              <p className="mt-2 text-[8px] font-bold text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100">
                إذا لم يظهر طلب التثبيت، يرجى استخدام متصفح Chrome والضغط على "تثبيت التطبيق" من القائمة.
              </p>
            )}
            {isIOS && !isPWA && (
              <div className="mt-3 pt-3 border-t border-slate-200/50 space-y-1.5">
                <p className="text-[9px] font-bold text-slate-500 uppercase">تعليمات آيفون:</p>
                <div className="flex items-center gap-2 text-[8px] font-bold text-slate-400 bg-white/50 p-1.5 rounded-lg">
                  <span className="w-3.5 h-3.5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">1</span>
                  اضغط "مشاركة" (Share) ثم "إضافة للشاشة الرئيسية"
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Push Notifications */}
          <div className={cn(
            "p-4 rounded-3xl border-2 transition-all duration-500",
            isSubscribed ? "bg-emerald-50 border-emerald-100" : "bg-slate-50 border-slate-100"
          )}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-colors duration-500",
                  isSubscribed ? "bg-emerald-500 text-white" : "bg-white text-slate-400"
                )}>
                  {isSubscribed ? <CheckCircle2 className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                </div>
                <div className="text-right">
                  <p className={cn("text-xs font-black mb-0.5", isSubscribed ? "text-emerald-700" : "text-slate-900")}>تفعيل التنبيهات</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">لاستلام الرسائل والدرجات</p>
                </div>
              </div>
              {!isSubscribed && (
                <Button 
                  onClick={subscribeToNotifications}
                  disabled={!isPWA}
                  className={cn(
                    "h-9 px-5 rounded-xl font-black text-[10px] shadow-lg transition-all",
                    isPWA ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100" : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                  )}
                >
                  تفعيل
                </Button>
              )}
            </div>
          </div>

          {/* Step 3: Background Sync */}
          <div className={cn(
            "p-4 rounded-3xl border-2 transition-all duration-500",
            backgroundAllowed ? "bg-emerald-50 border-emerald-100" : "bg-slate-50 border-slate-100"
          )}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-colors duration-500",
                  backgroundAllowed ? "bg-emerald-500 text-white" : "bg-white text-slate-400"
                )}>
                  {backgroundAllowed ? <CheckCircle2 className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                </div>
                <div className="text-right">
                  <p className={cn("text-xs font-black mb-0.5", backgroundAllowed ? "text-emerald-700" : "text-slate-900")}>التشغيل في الخلفية</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">لضمان عمل النظام دائماً</p>
                </div>
              </div>
              {!backgroundAllowed && (
                <Button 
                  onClick={handleBackgroundEnable}
                  disabled={!isSubscribed}
                  className={cn(
                    "h-9 px-5 rounded-xl font-black text-[10px] shadow-lg transition-all",
                    isSubscribed ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100" : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                  )}
                >
                  تفعيل
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest flex items-center justify-center gap-2">
            <CheckCircle2 className="w-3 h-3" /> تم التحقق من جودة النظام
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [schoolBranding, setSchoolBranding] = useState({ name: 'المدرسة', logo: '' });

  useEffect(() => {
    const fetchBranding = async () => {
      if (user?.schoolId) {
        const { data } = await supabase.from('schools').select('name, logo_url, icon_url').eq('id', user.schoolId).single();
        if (data) {
          // Add cache busting timestamp to ensure fresh image load when updated in dashboard
          const timestamp = Date.now();
          const logo = data.icon_url || data.logo_url || '';
          const logoWithCacheBust = logo ? (logo.includes('?') ? `${logo}&v=${timestamp}` : `${logo}?v=${timestamp}`) : '';

          setSchoolBranding({
            name: data.name,
            logo: logoWithCacheBust
          });
        }
      }
    };
    fetchBranding();
  }, [user?.schoolId]);

  // Handle mandatory setup for ALL roles (PWA, Notifications)
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
  const { permission } = usePushNotifications();
  
  // Show a non-blocking toast reminder if user is in browser but already logged in
  useEffect(() => {
    if (user && !isPWA) {
       // We can use a small notification or toast here if needed
    }
  }, [user, isPWA]);

  // Quick navigation search
  const allLinks = useMemo(() => {
    const links = [
      { to: '/', label: 'لوحة التحكم' },
      { to: '/students', label: 'الطلاب' },
      { to: '/teachers', label: 'المعلمون' },
      { to: '/parents', label: 'أولياء الأمور' },
      { to: '/classes', label: 'الفصول الدراسية' },
      { to: '/curriculum-management', label: 'إدارة المناهج' },
      { to: '/grades', label: 'الدرجات والتقييم' },
      { to: '/attendance', label: 'سجل الحضور' },
      { to: '/fees', label: 'المصروفات' },
      { to: '/messages', label: 'الرسائل' },
      { to: '/manage-complaints', label: 'الشكاوى' },
      { to: '/settings', label: 'الإعدادات' },
    ];
    return links.filter(l => searchQuery && l.label.includes(searchQuery));
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-[#FDFEFF] flex flex-col lg:flex-row font-cairo selection:bg-primary/20 overflow-x-hidden relative" dir="rtl">
      {/* Dynamic Background Noise/Texture */}
      <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none z-0" />
      
      <GlobalAnnouncement />
      <MandatoryNotifications />

      {/* Mobile Glass Header */}
      <div className="lg:hidden flex items-center justify-between px-6 py-4 bg-white/70 backdrop-blur-2xl border-b border-slate-100 sticky top-0 z-[60] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center text-white shadow-lg shadow-indigo-200/50 overflow-hidden">
            {schoolBranding.logo ? (
              <img 
                src={schoolBranding.logo} 
                alt="School Logo" 
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  setSchoolBranding(prev => ({ ...prev, logo: '' }));
                }}
              />
            ) : (
              <BookOpen className="w-5 h-5" />
            )}
          </div>
          <span className="text-xl font-black tracking-tight text-slate-900 truncate max-w-[200px]">{schoolBranding.name}</span>
        </div>
        <button 
          onClick={() => setSidebarOpen(true)}
          className={cn(
            "p-3 rounded-2xl bg-white text-slate-900 hover:bg-slate-50 transition-all active:scale-95 border border-slate-100 shadow-sm",
            user?.role === 'parent' ? "hidden md:flex" : "flex"
          )}
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] lg:hidden animate-in fade-in duration-500" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Fixed Desktop Sidebar Container */}
      <aside className={cn(
        "fixed inset-y-0 right-0 w-72 z-[80] transition-all duration-700 ease-out transform shadow-2xl lg:translate-x-0 bg-slate-900",
        sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
      )}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </aside>

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-0 relative lg:mr-72 bg-[#F8FAFC] overflow-hidden pb-24 md:pb-0 transition-all duration-700">
        {/* Abstract Background Gradients */}
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-500/5 rounded-full blur-[100px] pointer-events-none" />
        
        {/* Desktop Header Navigation */}
        <div className="hidden lg:flex items-center justify-between px-12 py-8 relative z-50">
           <div className="flex items-center gap-4">
              <div className="p-1 px-4 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest border border-indigo-100/50">
                 نظام الإدارة الذكي — {schoolBranding.name}
              </div>
           </div>

           <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 p-2 rounded-2xl bg-white border border-slate-100 shadow-sm px-5 h-12 group focus-within:ring-4 focus-within:ring-indigo-500/5 transition-all relative">
                 <Search className="w-4 h-4 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                 <input 
                    type="text" 
                    placeholder="بحث سريع عن الطلاب أو المعلمين..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent border-none text-xs font-bold placeholder:text-slate-300 focus:outline-none w-64" 
                 />
                 
                 {/* Search Results Dropdown */}
                 {allLinks.length > 0 && (
                   <div className="absolute top-full right-0 left-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[100] animate-in fade-in slide-in-from-top-2">
                     {allLinks.map(link => (
                       <button
                         key={link.to}
                         onClick={() => {
                           navigate(link.to);
                           setSearchQuery('');
                         }}
                         className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 text-right group transition-all"
                       >
                         <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-600">{link.label}</span>
                         <ChevronLeft className="w-4 h-4 text-slate-200 group-hover:text-indigo-600" />
                       </button>
                     ))}
                   </div>
                 )}
              </div>
              
              <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all cursor-pointer shadow-sm relative hover:scale-105 active:scale-95 group">
                 <Bell className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                 <span className="absolute top-3.5 right-3.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
              </div>

              <div className="h-8 w-px bg-slate-200/50 mx-2" />

              <div className="flex items-center gap-3 p-1.5 pl-5 rounded-2xl bg-slate-900 text-white shadow-xl shadow-indigo-900/10 group cursor-pointer hover:translate-y-[-2px] transition-all h-12">
                 <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 group-hover:bg-white/20 transition-colors">
                    <User className="w-4 h-4" />
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] hidden xl:block">حسابي الشخصي</span>
              </div>
           </div>
        </div>

        {/* Scaled Padding for Main Content */}
        <div className="flex-1 w-full px-6 sm:px-10 lg:px-16 py-4 animate-in fade-in slide-in-from-bottom-4 duration-1000 relative z-10">
          {children}
        </div>
        
        {/* Scaled Footer */}
        <footer className="py-12 px-16 relative z-10 border-t border-slate-100/50 bg-white/30 backdrop-blur-md mt-20 pb-24 md:pb-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 max-w-[1400px] mx-auto">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center shadow-inner border border-white overflow-hidden">
                   {schoolBranding.logo ? (
                     <img src={schoolBranding.logo} alt="Logo" className="w-full h-full object-contain p-2" />
                   ) : (
                     <BookOpen className="w-6 h-6 text-slate-400" />
                   )}
                </div>
                <div>
                   <p className="text-sm font-black text-slate-900 leading-none mb-1">{schoolBranding.name}</p>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">منصة التعليم المتكاملة</p>
                </div>
             </div>
             
             <div className="text-center md:text-right">
                <p className="text-sm font-black text-slate-900 border-b-2 border-indigo-500/20 pb-1 inline-block"> تطوير: عبدالرحمن سيد فوزي </p>
                <p className="text-[10px] font-bold text-slate-300 tracking-[0.3em] mt-3"> جميع الحقوق محفوظة © {new Date().getFullYear()} </p>
             </div>
          </div>
        </footer>
      </main>
      
      <BottomNav />
    </div>
  );
}
