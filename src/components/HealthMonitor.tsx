import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ShieldAlert, WifiOff, RefreshCw } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import { realtimeEngine } from '@/lib/RealtimeEngine';

type ConnectionStatus = 'online' | 'offline' | 'error';

export function HealthMonitor() {
  const [status, setStatus] = useState<ConnectionStatus>('online');
  const [isRetrying, setIsRetrying] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetchAll = useCallback(() => {
    // React Query's focusManager handles this automatically in web browsers
    // but we can manually invalidate active queries if we want to be extra sure
    // during health recovery.
    queryClient.invalidateQueries({ type: 'active' });
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
        console.log('👀 Tab visible/focused, validating health...');
        
        // Step 1: Check connection status
        const newStatus = await checkConnection();
        setStatus(newStatus);
        
        if (newStatus === 'online') {
          // Step 2: Validate session
          await validateSession();
          
          // Step 3: Resync realtime channels (wait for them to be healthy)
          await realtimeEngine.resyncAll();
          
          // Step 4: Small delay to ensure channels are ready before refetching
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Step 5: Resume any paused mutations (writes that failed while offline)
          await queryClient.resumePausedMutations();
          
          // Step 6: Invalidate active queries to trigger refetch
          refetchAll();
          
          // Track that we recovered from offline
          if (status === 'offline' || status === 'error') {
            setWasOffline(true);
            setTimeout(() => setWasOffline(false), 3000);
          }
        }
      }
    };

    window.addEventListener('online', () => setStatus('online'));
    window.addEventListener('offline', () => setStatus('offline'));
    window.addEventListener('visibilitychange', handleFocusOrVisible);
    window.addEventListener('focus', handleFocusOrVisible);
    
    // Periodic health check every 60s
    const interval = setInterval(async () => {
      if (window.navigator.onLine) {
        const newStatus = await checkConnection();
        if (newStatus !== status) setStatus(newStatus);
      }
    }, 60000);

    return () => {
      clearInterval(interval);
      const currentTimer = retryTimerRef.current;
      if (currentTimer) clearTimeout(currentTimer);
      window.removeEventListener('online', () => setStatus('online'));
      window.removeEventListener('offline', () => setStatus('offline'));
      window.removeEventListener('visibilitychange', handleFocusOrVisible);
      window.removeEventListener('focus', handleFocusOrVisible);
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
