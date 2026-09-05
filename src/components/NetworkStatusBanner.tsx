import { useState, useEffect } from 'react';
import { WifiOff, CheckCircle2, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { logger } from '@/utils/logger';

export default function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(() => 
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showBanner, setShowBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleOnline = () => {
      logger.log('🌐 [Network] Connection restored — triggering silent background re-sync');
      setIsOnline(true);
      setShowBanner(true);

      // Invalidate active queries to refresh stale data seamlessly
      queryClient.invalidateQueries();

      // Auto-hide the "Restored" success banner after 3.5 seconds
      const timer = setTimeout(() => {
        setShowBanner(false);
        setWasOffline(false);
      }, 3500);

      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      logger.warn('⚠️ [Network] Connection lost — switching to local cache mode');
      setIsOnline(false);
      setShowBanner(true);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check: if already offline when mounting
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      setShowBanner(true);
      setWasOffline(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [queryClient]);

  if (!showBanner) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "sticky top-0 z-[100] w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold transition-all duration-300 shadow-md backdrop-blur-md",
        !isOnline
          ? "bg-amber-500/95 text-slate-900 border-b border-amber-600/20"
          : "bg-emerald-600/95 text-white border-b border-emerald-700/20"
      )}
    >
      <div className="flex items-center gap-2.5 mx-auto max-w-5xl">
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4 text-slate-900 shrink-0 animate-pulse" />
            <span>
              أنت تعمل حالياً دون اتصال بالإنترنت — يتم عرض البيانات المحفوظة محلياً، وستتم المزامنة تلقائياً فور عودة الاتصال.
            </span>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4 text-white shrink-0 animate-bounce" />
            <span>
              تمت استعادة الاتصال بالإنترنت بنجاح — جاري مزامنة أحدث البيانات...
            </span>
          </>
        )}
      </div>

      <button
        onClick={() => setShowBanner(false)}
        className="p-1 rounded-lg hover:bg-black/10 transition-colors shrink-0 mr-2"
        title="إغلاق التنبيه"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
