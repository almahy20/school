import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ShieldAlert, WifiOff, RefreshCw } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import { realtimeEngine } from '@/lib/RealtimeEngine';
import { focusManager } from "@tanstack/react-query";

type ConnectionStatus = 'online' | 'offline' | 'error';

export function HealthMonitor() {
  const [status, setStatus] = useState<ConnectionStatus>('online');
  const [isRetrying, setIsRetrying] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [isCoordinating, setIsCoordinating] = useState(false);
  const retryCountRef = useRef(0);

  const refetchAll = useCallback(() => {
    console.log('🔄 [HealthMonitor] Smart invalidating queries...');
    // Only invalidate stale queries (older than staleTime)
    // This prevents unnecessary refetching and loading states
    queryClient.invalidateQueries({ 
      type: 'active',
      stale: true // Only refetch if actually stale
    });
    // Background queries can wait - no rush
    setTimeout(() => {
      queryClient.invalidateQueries({ 
        type: 'inactive',
        stale: true
      });
    }, 5000);
  }, []);

  const validateSession = useCallback(async () => {
    try {
      // Use getSession with a timeout to prevent hanging on network issues
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Session timeout')), 5000)
      );
      
      const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]) as any;
      
      if (error || !session) {
        console.warn('⚠️ Session invalid or expired on focus');
        // AuthProvider's onAuthStateChange will handle the UI state
      } else {
        console.log('✅ Session validated');
      }
    } catch (e) {
      console.error('❌ Error validating session:', e);
    }
  }, []);

  const checkConnection = useCallback(async (): Promise<ConnectionStatus> => {
    if (!window.navigator.onLine) {
      return 'offline';
    }
    try {
      // Use a lightweight RPC or a simple table check
      const { error } = await supabase.from('schools').select('id').limit(1).maybeSingle();
      
      // ERR_NAME_NOT_RESOLVED often manifests as a fetch error
      if (error) {
        if (error.code === 'PGRST116') return 'online'; // Expected if no schools found
        throw error;
      }
      return 'online';
    } catch (err: any) {
      const msg = err?.message?.toLowerCase() || '';
      if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('dns')) {
        console.warn('📡 Network/DNS issue detected:', err);
        return 'offline';
      }
      console.error('⚠️ DB health check failed:', err);
      return 'error';
    }
  }, []);

  const coordinateRecovery = useCallback(async (forceResync = false) => {
    if (isCoordinating) return;
    setIsCoordinating(true);
    
    console.log('🚀 [HealthMonitor] Starting coordinated recovery sequence...', { forceResync });
    
    try {
      // 1. Mark React Query as focused
      focusManager.setFocused(true);

      // 2. Verify connection
      const newStatus = await checkConnection();
      setStatus(newStatus);
      
      if (newStatus === 'online') {
        // 3. Validate/Refresh session (CRITICAL: sequential, not parallel)
        await validateSession();
        
        // 4. Resync Realtime ONLY if forceResync is true (e.g., after network outage)
        // Skip on normal tab visibility changes - Supabase maintains WebSocket connection
        if (forceResync) {
          console.log('📡 [HealthMonitor] Force resyncing Realtime Engine...');
          await realtimeEngine.resyncAll();
        } else {
          console.log('✅ [HealthMonitor] Skipping realtime resync (connection maintained)');
        }
        
        // 5. Resume and Refresh Data
        console.log('📊 [HealthMonitor] Resuming mutations and refreshing data...');
        await queryClient.resumePausedMutations();
        refetchAll();
        
        if (wasOffline) {
          setWasOffline(true);
          setTimeout(() => setWasOffline(false), 3000);
        }
      }
    } catch (err) {
      console.error('❌ [HealthMonitor] Coordinated recovery failed:', err);
    } finally {
      setIsCoordinating(false);
      console.log('🏁 [HealthMonitor] Coordinated recovery finished');
    }
  }, [checkConnection, validateSession, refetchAll, isCoordinating, wasOffline]);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    await coordinateRecovery();
    setIsRetrying(false);
  }, [coordinateRecovery]);

  useEffect(() => {
    checkConnection().then(setStatus);

    const handleOnline = () => {
      console.log('🌐 [HealthMonitor] Browser back online - full recovery');
      setStatus('online');
      // Force full recovery after network outage (includes realtime resync)
      coordinateRecovery(true);
    };
    
    const handleOffline = () => {
      console.log('📵 [HealthMonitor] Browser went offline');
      setStatus('offline');
      focusManager.setFocused(false);
    };
    
    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ [HealthMonitor] Tab focused/visible - lightweight check only');
        // Don't force resync on normal tab visibility - Supabase WebSocket stays alive
        // Only do lightweight connection check and data refresh
        coordinateRecovery(false);
      } else {
        focusManager.setFocused(false);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('visibilitychange', handleFocusOrVisible);
    window.addEventListener('focus', handleFocusOrVisible);
    
    const interval = setInterval(async () => {
      if (window.navigator.onLine && !isCoordinating) {
        const newStatus = await checkConnection();
        if (newStatus !== status) {
          setStatus(newStatus);
          if (newStatus === 'online' && status !== 'online') {
            coordinateRecovery();
          }
        }
      }
    }, 60000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('visibilitychange', handleFocusOrVisible);
      window.removeEventListener('focus', handleFocusOrVisible);
    };
  }, [coordinateRecovery, checkConnection, isCoordinating, status]);

  if (wasOffline && status === 'online') {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] animate-in slide-in-from-top-4 duration-500" dir="rtl">
        <div className="px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 bg-emerald-600 border border-emerald-400 text-white">
          <div className="w-2 h-2 rounded-full bg-white animate-ping" />
          <span className="text-sm font-black tracking-tight">متصل الآن — تم تحديث البيانات</span>
        </div>
      </div>
    );
  }

  if (status === 'online') return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] animate-in slide-in-from-top-4 duration-500 w-[90%] max-w-md" dir="rtl">
      <div className={`px-4 sm:px-6 py-3 sm:py-4 rounded-2xl sm:rounded-full shadow-2xl flex items-center justify-between gap-4 border ${
        status === 'offline' ? 'bg-amber-600 border-amber-400' : 'bg-rose-600 border-rose-400'
      } text-white`}>
        <div className="flex items-center gap-3 min-w-0">
          {status === 'offline' ? <WifiOff className="w-5 h-5 shrink-0" /> : <ShieldAlert className="w-5 h-5 shrink-0" />}
          <span className="text-xs sm:text-sm font-black tracking-tight truncate">
            {status === 'offline' ? 'انقطع الاتصال — جاري المحاولة...' : 'عذراً، تعذر الوصول للخادم'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={handleRetry} 
            disabled={isRetrying}
            className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-all active:scale-90 disabled:opacity-50"
            title="إعادة الاتصال الآن"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
          </button>
          
          <button 
            onClick={() => window.location.reload()} 
            className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-all active:scale-90"
            title="تحديث الصفحة"
          >
            <RefreshCw className="w-4 h-4 rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
}
