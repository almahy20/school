import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function PWAInstallPrompt() {
  const { user } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [branding, setBranding] = useState({ name: 'المدرسة', icon: '' });

  useEffect(() => {
    const fetchBranding = async () => {
      if (user?.schoolId) {
        const { data } = await supabase.from('schools').select('name, logo_url, icon_url').eq('id', user.schoolId).single();
        if (data) {
          const timestamp = Date.now();
          const icon = data.icon_url || data.logo_url || '';
          const iconWithCacheBust = icon ? (icon.includes('?') ? `${icon}&v=${timestamp}` : `${icon}?v=${timestamp}`) : '';
          
          setBranding({
            name: data.name,
            icon: iconWithCacheBust
          });
        }
      }
    };
    fetchBranding();

    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // If the app is already installed, or in standalone mode, we can hide it.
    if (window.matchMedia('(display-mode: standalone)').matches) {
       setIsVisible(false);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const installApp = () => {
    if (!deferredPrompt) return;
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    deferredPrompt.userChoice.then((choiceResult: any) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      setDeferredPrompt(null);
      setIsVisible(false);
    });
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-8 md:bottom-8 md:w-96 bg-white p-5 rounded-[32px] shadow-2xl border border-indigo-100 z-[9999] animate-in slide-in-from-bottom-5 duration-500" dir="rtl">
      <div className="flex items-start gap-4">
         <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0 overflow-hidden shadow-sm border border-slate-50">
            {branding.icon ? (
              <img src={branding.icon} alt="School Logo" className="w-full h-full object-cover" />
            ) : (
              <Download className="w-6 h-6 text-indigo-600" />
            )}
         </div>
         <div className="flex-1 space-y-3">
            <div>
               <h3 className="font-black text-slate-900 leading-tight">تطبيق {branding.name} الذكي</h3>
               <p className="text-xs font-bold text-slate-500 mt-1 leading-relaxed">
                  قم بتثبيت التطبيق للحصول على <span className="text-indigo-600">التنبيهات الفورية</span> (الدرجات، الغياب، الرسائل) حتى عندما يكون التطبيق مغلقاً.
               </p>
            </div>
            <div className="flex gap-2">
               <button 
                 onClick={installApp} 
                 className="flex-1 bg-indigo-600 text-white text-xs font-black py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
               >
                 تثبيت الآن
               </button>
               <button 
                 onClick={() => setIsVisible(false)} 
                 className="px-4 bg-slate-50 text-slate-600 text-xs font-bold py-3 rounded-xl hover:bg-slate-100 transition-colors"
               >
                 ليس الآن
               </button>
            </div>
         </div>
      </div>
    </div>
  );
}
