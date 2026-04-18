import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { logger } from '@/utils/logger';

interface QueryStateHandlerProps {
  loading: boolean;
  error: any;
  data: any;
  onRetry: () => void;
  isRefetching?: boolean;
  errorMessage?: string;
  emptyMessage?: string;
  loadingMessage?: string;
  children: React.ReactNode;
  isEmpty?: boolean;
}

export function QueryStateHandler({
  loading,
  error,
  data,
  onRetry,
  isRefetching = false,
  errorMessage = 'عذراً، حدث خطأ أثناء جلب البيانات. يرجى التأكد من اتصال الإنترنت والمحاولة مرة أخرى.',
  emptyMessage = 'لم يتم العثور على بيانات.',
  loadingMessage = 'جاري التحميل...',
  children,
  isEmpty = false,
}: QueryStateHandlerProps) {
  
  const [showTimeoutError, setShowTimeoutError] = React.useState(false);
  const loadingStartRef = React.useRef<number>(0);

  // ✅ Watchdog: لو التحميل طول عن 30 ثانية، اظهر زر إعادة محاولة
  React.useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    
    if (loading && !isRefetching) {
      // Store start time in ref to avoid re-renders
      loadingStartRef.current = Date.now();
      
      timer = setTimeout(() => {
        setShowTimeoutError(true);
      }, 30000); // 30 ثانية
    } else {
      // Reset timeout error when loading completes
      if (showTimeoutError) {
        setShowTimeoutError(false);
      }
      
      // Log slow loading (only if it took more than 5 seconds)
      if (loadingStartRef.current > 0) {
        const loadDuration = Date.now() - loadingStartRef.current;
        if (loadDuration > 5000) {
          logger.log(`⏱️ [QueryStateHandler] Loading took ${Math.round(loadDuration / 1000)}s (slow but successful)`);
        }
        // Reset the ref
        loadingStartRef.current = 0;
      }
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [loading, isRefetching]); // Removed loadingStartTime from dependencies

  // Use either the real error or the timeout error
  const finalError = error || (showTimeoutError ? new Error('تأخرت الاستجابة من السيرفر') : null);

  // 1. Loading State
  if (loading && !isRefetching && !showTimeoutError) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-6 p-8 animate-in fade-in duration-500 rounded-[40px] bg-slate-50/50 border border-slate-100/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 w-16 h-16 border-4 border-indigo-100 rounded-full animate-ping opacity-75"></div>
          <div className="relative w-16 h-16 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin shadow-lg"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-4 h-4 bg-indigo-500 rounded-full animate-pulse"></div>
          </div>
        </div>
        <p className="text-slate-500 font-bold text-sm tracking-widest uppercase animate-pulse">{loadingMessage}</p>
      </div>
    );
  }

  // 2. Error State
  if (finalError) {
    const isTimeout = showTimeoutError && !error;
    const loadDuration = Date.now() - loadingStartRef.current;
    
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-8 p-10 text-center bg-white rounded-[40px] border border-rose-100 shadow-2xl shadow-rose-900/5 animate-in fade-in slide-in-from-bottom-8 duration-700 relative overflow-hidden group">
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500/0 via-rose-500 to-rose-500/0 opacity-50"></div>
        <div className="w-24 h-24 rounded-[40px] bg-rose-50 flex items-center justify-center text-rose-500 shadow-inner border border-rose-100 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 relative">
          <div className="absolute inset-0 bg-rose-400 rounded-[40px] blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
          <AlertCircle className="w-10 h-10 relative z-10" />
        </div>
        <div className="space-y-4 max-w-md">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {isTimeout ? 'استغرقت العملية وقتاً طويلاً' : 'حدث خطأ في الاتصال'}
          </h2>
          <p className="text-slate-500 font-medium leading-relaxed">
            {isTimeout 
              ? `استمرت المحاولة ${Math.round(loadDuration / 1000)} ثانية. قد يكون هناك مشكلة في الشبكة أو ضغط على الخادم.` 
              : errorMessage}
          </p>
        </div>
        <Button 
          onClick={() => {
            setShowTimeoutError(false);
            onRetry();
          }}
          disabled={isRefetching}
          className="h-14 px-10 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-lg flex items-center gap-3 shadow-xl shadow-rose-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] overflow-hidden relative group"
        >
          <div className="absolute inset-0 w-full h-full bg-white/20 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
          <RefreshCw className={cn("w-5 h-5", isRefetching && "animate-spin")} />
          إعادة المحاولة الآن
        </Button>
      </div>
    );
  }

  // 3. Empty State
  const isDataEmpty = isEmpty || (Array.isArray(data) && data.length === 0) || !data;
  
  if (isDataEmpty && !isRefetching) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-8 p-12 text-center bg-white/60 backdrop-blur-3xl rounded-[40px] border border-slate-100/80 shadow-2xl shadow-indigo-900/5 animate-in fade-in zoom-in-95 duration-700 relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-slate-100 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>
        
        <div className="w-24 h-24 rounded-[40px] bg-slate-50 flex items-center justify-center text-slate-300 shadow-inner border border-slate-100 hover:-translate-y-2 transition-transform duration-500 relative z-10">
          <AlertCircle className="w-10 h-10" />
        </div>
        <div className="space-y-3 max-w-md relative z-10">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">لا توجد سجلات</h2>
          <p className="text-slate-400 font-bold leading-relaxed">{emptyMessage}</p>
        </div>
        <Button 
          onClick={onRetry}
          variant="outline"
          className="h-12 px-8 rounded-xl border-2 border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-slate-600 font-bold hover:text-slate-900 transition-all relative z-10"
        >
          <RefreshCw className="w-4 h-4 ml-2" />
          تحديث الصفحة
        </Button>
      </div>
    );
  }

  // 4. Success State (Clean children render)
  return (
    <div className="relative">
      {children}
    </div>
  );
}
