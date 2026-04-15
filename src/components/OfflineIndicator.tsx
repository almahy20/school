import { useState, useEffect } from 'react';
import { WifiOff, CloudOff, Cloud } from 'lucide-react';
import { backgroundSync } from '@/lib/backgroundSync';

/**
 * Offline Status Indicator
 * 
 * Shows offline status and pending sync count
 * Provides manual sync button
 */

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Listen to online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Watch pending mutations
    backgroundSync.startWatching((count) => {
      setPendingCount(count);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      // Safe cleanup - stopWatching handles the unsubscribe internally
      backgroundSync.stopWatching?.();
    };
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await backgroundSync.triggerSync();
      console.log(`✅ [OfflineIndicator] Sync complete: ${result.success} succeeded, ${result.failed} failed`);
    } catch (error) {
      console.error('❌ [OfflineIndicator] Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Don't show if online and no pending mutations
  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] animate-in slide-in-from-bottom-4 duration-300" dir="rtl">
      <div className={`px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border backdrop-blur-sm ${
        isOnline 
          ? 'bg-emerald-500/90 border-emerald-400 text-white'
          : 'bg-amber-500/90 border-amber-400 text-white'
      }`}>
        {/* Icon */}
        {isOnline ? (
          <Cloud className="w-5 h-5" />
        ) : (
          <WifiOff className="w-5 h-5" />
        )}

        {/* Status Text */}
        <div className="flex flex-col">
          <span className="text-sm font-bold">
            {isOnline ? 'متصل' : 'غير متصل'}
          </span>
          
          {pendingCount > 0 && (
            <span className="text-xs opacity-90">
              {pendingCount} {pendingCount === 1 ? 'عملية معلقة' : 'عمليات معلقة'}
            </span>
          )}
        </div>

        {/* Sync Button (only when online and has pending) */}
        {isOnline && pendingCount > 0 && (
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 transition-all active:scale-95 disabled:opacity-50 text-sm font-bold"
          >
            {isSyncing ? (
              <span className="flex items-center gap-2">
                <CloudOff className="w-4 h-4 animate-spin" />
                جاري المزامنة...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Cloud className="w-4 h-4" />
                مزامنة الآن
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
