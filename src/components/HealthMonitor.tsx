import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ShieldAlert, WifiOff, RefreshCw } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import { focusManager } from '@tanstack/react-query';

type ConnectionStatus = 'online' | 'offline' | 'error';

export function HealthMonitor() {
  const [status, setStatus] = useState<ConnectionStatus>('online');
  const [isRetrying, setIsRetrying] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetchAll = useCallback(() => {
    console.log('🔄 HealthMonitor: Ensuring React Query is aware of focus...');
    // React Query's focusManager automatically triggers refetch for all queries 
    // that have refetchOnWindowFocus: true (which is our default).
    // We just need to ensure it knows the window is focused.
    focusManager.setFocused(true);
  }, []);

  const validateSession = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        console.warn('⚠️ Session invalid on focus, AuthProvider will handle redirect.');
      }
    } catch (e) {
      console.error('❌ Error validating session on focus:', e);
    }
  }, []);

  const checkConnection = useCallback(async (): Promise<ConnectionStatus> => {
    if (!window.navigator.onLine) {
      return 'offline';
    }
    try {
      const { error } = await supabase.from('schools').select('id').limit(1).maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return 'online';
    } catch (err) {
      console.error('⚠️ DB health check failed:', err);
      return 'error';
    }
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);
    const newStatus = await checkConnection();
    setStatus(newStatus);
    setIsRetrying(false);
    if (newStatus === 'online') {
      retryCountRef.current = 0;
      refetchAll();
    }
  };

  useEffect(() => {
    checkConnection().then(setStatus);

    const handleFocusOrVisible = async () => {
      if (document.visibilityState === 'visible') {
        // Just check connection, React Query handles the focus refetching automatically
        const newStatus = await checkConnection();
        setStatus(newStatus);
        
        if (newStatus === 'online') {
          await validateSession();
        }
      }
    };

    window.addEventListener('online', handleFocusOrVisible);
    window.addEventListener('offline', () => setStatus('offline'));
    // We don't need manual focus/visibility listeners for refetching 
    // because React Query handles refetchOnWindowFocus automatically.
    // We only listen to visibilitychange to update our internal connection status and session.
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    // Periodic health check every 60s
    const interval = setInterval(async () => {
      if (window.navigator.onLine) {
        const newStatus = await checkConnection();
        if (newStatus !== status) setStatus(newStatus);
      }
    }, 60000);

    return () => {
      clearInterval(interval);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      window.removeEventListener('online', handleFocusOrVisible);
      window.removeEventListener('offline', () => setStatus('offline'));
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, [checkConnection, validateSession, status]);

  // Show "reconnected" green banner briefly
  if (wasOffline && status === 'online') {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] animate-in slide-in-from-top-4 duration-500" dir="rtl">
        <div className="px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 bg-emerald-500 border border-emerald-600 text-white">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="text-sm font-black tracking-tight">تم استعادة الاتصال بنجاح</span>
        </div>
      </div>
    );
  }

  if (status === 'online') return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] animate-in slide-in-from-top-4 duration-500" dir="rtl">
      <div className={`px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 border ${
        status === 'offline' ? 'bg-amber-500 border-amber-600' : 'bg-rose-500 border-rose-600'
      } text-white`}>
        {status === 'offline' ? <WifiOff className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
        
        <span className="text-sm font-black tracking-tight">
          {status === 'offline' ? 'لا يوجد اتصال بالإنترنت — جاري إعادة المحاولة...' : 'خطأ في الاتصال بقاعدة البيانات'}
        </span>

        <button 
          onClick={handleRetry} 
          disabled={isRetrying}
          className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50"
          title="إعادة المحاولة"
        >
          <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}
