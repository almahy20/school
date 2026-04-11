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
    // Invalidate ALL queries (not just active) to ensure fresh data on tab return
    // This forces React Query to refetch everything from the server
    queryClient.invalidateQueries();
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

    // Define handlers outside to ensure proper cleanup
    const handleOnline = () => setStatus('online');
    const handleOffline = () => setStatus('offline');
    
    const handleFocusOrVisible = async () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ Tab visible/focused, validating health...');
        
        // Step 1: Check connection status
        const newStatus = await checkConnection();
        setStatus(newStatus);
        
        if (newStatus === 'online') {
          // Step 2: Validate session
          await validateSession();
          
          // Step 3: Resync realtime channels (RealtimeEngine handles this robustly now)
          console.log('🔄 Triggering RealtimeEngine resync...');
          await realtimeEngine.resyncAll();
          
          // Step 4: Small delay to ensure channels are ready before refetching
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Step 5: Check if resync was successful
          const resyncStatus = realtimeEngine.getSubscriptionStatus();
          const healthyChannels = Object.values(resyncStatus).filter((s: any) => s.isHealthy).length;
          const totalChannels = Object.keys(resyncStatus).length;
          
          console.log(`📊 Resync status: ${healthyChannels}/${totalChannels} channels healthy`);
          
          // If less than 50% of channels are healthy, log warning but DON'T reload page
          // React Query's refetchOnWindowFocus will handle data refresh automatically
          if (totalChannels > 0 && healthyChannels < totalChannels * 0.5) {
            console.warn(`⚠️ Low healthy channels: ${healthyChannels}/${totalChannels}. RealtimeEngine will auto-recover.`);
            // Don't force reload - let RealtimeEngine handle reconnection
            // The user will see a warning banner but data will still load via React Query
          }
          
          // Step 6: Resume any paused mutations (writes that failed while offline)
          await queryClient.resumePausedMutations();
          
          // Step 7: Invalidate active queries to trigger refetch
          refetchAll();
          
          // Track that we recovered from offline
          if (status === 'offline' || status === 'error') {
            setWasOffline(true);
            setTimeout(() => setWasOffline(false), 3000);
          }
          
          console.log('✅ Health check and resync complete');
        }
      }
    };

    // Register listeners with proper references
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('visibilitychange', handleFocusOrVisible);
    window.addEventListener('focus', handleFocusOrVisible);
    
    // Periodic health check every 60s
    const interval = setInterval(async () => {
      if (window.navigator.onLine) {
        const newStatus = await checkConnection();
        if (newStatus !== status) {
          console.log(`🔄 Connection status changed: ${status} → ${newStatus}`);
          setStatus(newStatus);
        }
        
        // If we're online but status shows error, try to recover
        if (newStatus === 'online' && status === 'error') {
          console.log('🔧 Attempting automatic recovery...');
          await realtimeEngine.resyncAll();
          refetchAll();
        }
      }
    }, 60000);

    // Proper cleanup
    return () => {
      clearInterval(interval);
      const currentTimer = retryTimerRef.current;
      if (currentTimer) clearTimeout(currentTimer);
      
      // Remove listeners with correct references
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('visibilitychange', handleFocusOrVisible);
      window.removeEventListener('focus', handleFocusOrVisible);
      
      // Note: We don't destroy RealtimeEngine here as it's a singleton
      // that should persist for the app lifecycle
    };
  }, [checkConnection, validateSession, status, refetchAll]);

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
        
        <button 
          onClick={() => window.location.reload()} 
          className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
          title="إعادة تحميل الصفحة"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
