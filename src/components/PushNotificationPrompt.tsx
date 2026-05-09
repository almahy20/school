import { useState, useEffect } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Bell, X, ShieldCheck, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export default function PushNotificationPrompt() {
  const { user } = useAuth();
  const { permission, isSubscribed, subscribeToNotifications } = usePushNotifications();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Only show if:
    // 1. User is logged in
    // 2. Notifications are not granted
    // 3. Not already subscribed
    // 4. Not dismissed in this session
    // 5. Browser supports notifications
    if (
      user && 
      permission === 'default' && 
      !isSubscribed && 
      !isDismissed && 
      'Notification' in window
    ) {
      // Wait 3 seconds before showing to not overwhelm the user
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [user, permission, isSubscribed, isDismissed]);

  const handleSubscribe = async () => {
    const success = await subscribeToNotifications();
    if (success) {
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    // Also save to session storage so we don't ask again in this session
    sessionStorage.setItem('push_prompt_dismissed', 'true');
  };

  // Check session storage on mount
  useEffect(() => {
    if (sessionStorage.getItem('push_prompt_dismissed') === 'true') {
      setIsDismissed(true);
    }
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-10 md:w-[400px] z-[100] animate-in fade-in slide-in-from-bottom-10 duration-500" dir="rtl">
      <div className="bg-slate-900 border border-slate-800 rounded-[32px] p-6 shadow-2xl shadow-indigo-500/20 relative overflow-hidden group">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500" />
        <div className="absolute -top-10 -left-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all duration-700" />
        
        <button 
          onClick={handleDismiss}
          className="absolute top-4 left-4 text-slate-500 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex gap-5 items-start relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-500/40 animate-bounce-slow">
            <Bell className="w-7 h-7" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
              تفعيل التنبيهات الفورية
              <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
            </h3>
            <p className="text-xs font-medium text-slate-400 leading-relaxed">
              ابقَ على اطلاع دائم بآخر المستجدات، الدرجات، والرسائل فور وصولها حتى والتطبيق مغلق.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3 relative z-10">
          <Button 
            onClick={handleSubscribe}
            className="flex-1 h-12 rounded-xl bg-white text-slate-900 font-black hover:bg-slate-100 transition-all shadow-xl active:scale-95"
          >
            تفعيل الآن
          </Button>
          <button 
            onClick={handleDismiss}
            className="px-6 h-12 rounded-xl bg-slate-800 text-slate-400 font-bold text-xs hover:bg-slate-700 transition-all"
          >
            ليس الآن
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-500 font-medium">
          <ShieldCheck className="w-3 h-3" />
          <span>يمكنك تغيير هذا الإعداد لاحقاً من الإعدادات.</span>
        </div>
      </div>
    </div>
  );
}
