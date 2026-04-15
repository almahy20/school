import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * مؤشر بسيط لحالة الاتصال
 */
export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] animate-in slide-in-from-bottom-4 duration-300" dir="rtl">
      <div className="px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border bg-amber-500/90 border-amber-400 text-white backdrop-blur-sm">
        <WifiOff className="w-5 h-5" />
        <div className="flex flex-col">
          <span className="text-sm font-bold">أنت غير متصل بالإنترنت</span>
          <span className="text-xs opacity-90">بعض الخصائص قد لا تعمل بشكل صحيح</span>
        </div>
      </div>
    </div>
  );
}
