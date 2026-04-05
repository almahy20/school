import { useState, useEffect } from 'react';
import { Bell, X, ShieldCheck, Zap } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { cn } from '@/lib/utils';

export default function NotificationBanner() {
  const { isSubscribed, subscribeToNotifications, permission } = usePushNotifications();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show banner if not subscribed and permission is not denied
    if (!isSubscribed && permission !== 'denied') {
      const timer = setTimeout(() => setIsVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [isSubscribed, permission]);

  if (!isVisible || isSubscribed) return null;

  return (
    <div className="fixed top-24 left-4 right-4 md:left-auto md:right-8 md:top-auto md:bottom-8 md:w-[450px] z-[9999] animate-in slide-in-from-right-10 duration-700" dir="rtl">
      <div className="bg-slate-900 rounded-[40px] p-8 shadow-2xl shadow-indigo-500/20 border border-white/10 relative overflow-hidden group">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-1000" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl -ml-12 -mb-12 group-hover:scale-150 transition-transform duration-1000" />
        
        <button 
          onClick={() => setIsVisible(false)}
          className="absolute top-6 left-6 text-white/20 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative z-10 space-y-8">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-3xl bg-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-600/20 rotate-3 group-hover:rotate-0 transition-transform duration-500">
              <Bell className="w-8 h-8 text-white animate-bounce" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight leading-tight mb-1">فعل التنبيهات الذكية</h3>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">كن أول من يعلم بكل جديد</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 group-hover:bg-white/10 transition-colors">
              <Zap className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-white/60 leading-relaxed">استقبل إشعارات فورية بخصوص غياب ابنك، درجاته الجديدة، والرسائل الهامة من الإدارة حتى والموقع مغلق.</p>
            </div>
            
            <div className="flex items-center gap-3 px-2">
               <ShieldCheck className="w-4 h-4 text-emerald-500" />
               <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">نظام آمن • لا نرسل رسائل مزعجة</span>
            </div>
          </div>

          <button 
            onClick={subscribeToNotifications}
            className="w-full h-16 rounded-2xl bg-white text-slate-900 font-black text-sm shadow-xl shadow-white/5 hover:translate-y-[-4px] active:scale-95 transition-all flex items-center justify-center gap-3 group/btn"
          >
            تفعيل الإشعارات الآن
            <div className="w-8 h-8 rounded-lg bg-slate-900/5 flex items-center justify-center group-hover/btn:bg-indigo-600 group-hover/btn:text-white transition-colors">
              <Bell className="w-4 h-4" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
