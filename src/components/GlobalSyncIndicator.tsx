import React from 'react';
import { useIsFetching } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';

/**
 * GlobalSyncIndicator provides a single, unified visual feedback
 * for all background data synchronization across the entire application.
 * This prevents the stacking issue where multiple components showed redundant indicators.
 */
export function GlobalSyncIndicator() {
  // useIsFetching returns the number of queries currently fetching data
  const isFetching = useIsFetching();
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isFetching > 0) {
      // Delay showing to avoid flickering for very fast requests
      timer = setTimeout(() => setShow(true), 800);
    } else {
      setShow(false);
    }
    return () => clearTimeout(timer);
  }, [isFetching]);

  if (!show) return null;

  return (
    <div className="fixed bottom-6 left-6 bg-white/95 backdrop-blur-xl px-4 py-2.5 rounded-2xl border border-slate-200 shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-6 duration-700 z-[9999] pointer-events-none group">
      <div className="relative flex items-center justify-center">
        <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
        <div className="absolute inset-0 bg-indigo-400 rounded-full blur-lg animate-pulse opacity-30" />
      </div>
      <div className="flex flex-col">
        <span className="text-slate-900 font-black text-[10px] tracking-widest uppercase">مزامنة فورية</span>
        <span className="text-slate-400 font-bold text-[9px]">جاري تحديث البيانات الذكي...</span>
      </div>
    </div>
  );
}
