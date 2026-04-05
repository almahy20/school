import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ShieldAlert, CheckCircle2, WifiOff, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function HealthMonitor() {
  const [status, setStatus] = useState<'online' | 'offline' | 'error'>('online');
  const [isRetrying, setIsRetrying] = useState(false);
  const { toast } = useToast();

  const checkConnection = async () => {
    if (!window.navigator.onLine) {
      setStatus('offline');
      return;
    }

    try {
      // Simple ping to Supabase to check reachability
      const { error } = await supabase.from('schools').select('id').limit(1);
      if (error) throw error;
      setStatus('online');
    } catch (err) {
      console.error('⚠️ Supabase connection health check failed:', err);
      setStatus('error');
    }
  };

  useEffect(() => {
    checkConnection();
    
    const interval = setInterval(checkConnection, 60000); // Check every minute
    
    window.addEventListener('online', checkConnection);
    window.addEventListener('offline', () => setStatus('offline'));

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', checkConnection);
      window.removeEventListener('offline', () => setStatus('offline'));
    };
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);
    await checkConnection();
    setIsRetrying(false);
    
    if (status === 'online') {
      toast({ title: "تمت استعادة الاتصال بنجاح", description: "يمكنك الآن متابعة عملك كالمعتاد." });
    }
  };

  if (status === 'online') return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] animate-in slide-in-from-top-4 duration-500" dir="rtl">
      <div className={`px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 border ${
        status === 'offline' ? 'bg-amber-500 border-amber-600' : 'bg-rose-500 border-rose-600'
      } text-white`}>
        {status === 'offline' ? <WifiOff className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
        
        <span className="text-sm font-black tracking-tight">
          {status === 'offline' ? 'لا يوجد اتصال بالإنترنت' : 'خطأ في الاتصال بقاعدة البيانات'}
        </span>

        <button 
          onClick={handleRetry} 
          disabled={isRetrying}
          className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}
