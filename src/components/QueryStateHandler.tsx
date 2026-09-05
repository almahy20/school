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
  skeleton?: React.ReactNode;
}

function DefaultGridSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-2 px-1">
        <div className="w-2 h-2 rounded-full bg-indigo-500/50 animate-pulse" />
        <div className="h-3.5 w-36 bg-slate-200/70 rounded-full animate-pulse" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-[28px] p-6 space-y-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-slate-100 rounded-lg animate-pulse" />
                <div className="h-3 w-1/2 bg-slate-100 rounded-lg animate-pulse" />
              </div>
              <div className="w-14 h-6 rounded-xl bg-slate-100 animate-pulse" />
            </div>
            <div className="space-y-2 pt-2">
              <div className="h-3 w-full bg-slate-50 rounded-md animate-pulse" />
              <div className="h-3 w-4/5 bg-slate-50 rounded-md animate-pulse" />
            </div>
            <div className="flex gap-2 pt-2">
              <div className="h-9 flex-1 rounded-xl bg-slate-100 animate-pulse" />
              <div className="h-9 w-10 rounded-xl bg-slate-100 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
      <div className="h-12 w-full rounded-2xl bg-slate-100 animate-pulse" />
    </div>
  );
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
  skeleton,
}: QueryStateHandlerProps) {
  
  const [showTimeoutError, setShowTimeoutError] = React.useState(false);
  const loadingStartRef = React.useRef<number>(0);

  // ✅ Watchdog: لو التحميل طول عن 15 ثانية، اظهر زر إعادة محاولة
  React.useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    
    if (loading && !isRefetching && !error) {
      loadingStartRef.current = Date.now();
      
      timer = setTimeout(() => {
        setShowTimeoutError(true);
      }, 15000); // 15 ثانية
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
  }, [loading, isRefetching, showTimeoutError, error]); // error included to reset timer when error appears

  // Use either the real error or the timeout error
  const finalError = error || (showTimeoutError ? new Error('تأخرت الاستجابة من السيرفر') : null);

  // 1. Error State - MUST be checked first to avoid hiding errors behind loading spinner
  if (finalError) {
    const isTimeout = showTimeoutError && !error;
    const loadDuration = Date.now() - loadingStartRef.current;
    
    // Log error for debugging
    logger.error('[QueryStateHandler] Error details:', {
      error: finalError,
      isTimeout,
      loadDuration,
      errorMessage
    });
    
    // Determine best error message
    let displayMessage = errorMessage;
    if (finalError.message) {
      if (finalError.message.includes('permission') || finalError.message.includes('Unauthorized') || finalError.message.includes('Unauthorized access')) {
        displayMessage = 'ليس لديك صلاحية للوصول إلى هذه البيانات. يرجى التواصل مع إدارة المدرسة.';
      } else if (finalError.message.includes('network') || finalError.message.includes('fetch')) {
        displayMessage = 'حدث خطأ في الاتصال بالإنترنت. يرجى التحقق من اتصالك والمحاولة مرة أخرى.';
      }
    }
    
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
              : displayMessage}
          </p>
          {/* Show technical details in development */}
          {process.env.NODE_ENV === 'development' && (
            <details className="text-left text-xs bg-slate-50 p-3 rounded-lg mt-2">
              <summary className="cursor-pointer text-slate-400 font-mono">Technical Details (Dev Only)</summary>
              <pre className="mt-2 text-slate-600 overflow-auto whitespace-pre-wrap">
                {JSON.stringify({
                  message: finalError.message,
                  code: finalError.code,
                  details: finalError.details,
                  hint: finalError.hint
                }, null, 2)}
              </pre>
            </details>
          )}
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

  // 2. Loading State — يُظهر spinner فقط إذا لم تكن هناك بيانات بعد (أول جلب حقيقي)
  //    إذا كانت هناك بيانات قديمة (placeholder/cache) نعرضها فوراً مع شريط تحديث خفيف
  //    ملاحظة: array فاضي [] = data وصلت بالفعل، مش "loading"
  // البيانات وصلت لو: data مش null/undefined، أو array فيها عناصر، أو object كامل
  const dataArrived = data !== undefined && data !== null && (!Array.isArray(data) || data.length > 0);
  if (loading && !isRefetching && !showTimeoutError && !dataArrived) {
    if (skeleton) {
      return <>{skeleton}</>;
    }
    return <DefaultGridSkeleton />;
  }

  // 3. Empty State
  const isDataEmpty = isEmpty || (Array.isArray(data) && data.length === 0) || !dataArrived;
  
  if (isDataEmpty && !loading && !isRefetching) {
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

  // 4. Success State — يعرض المحتوى مع شريط تحديث خفيف في الأعلى عند إعادة الجلب
  const isBackgroundRefetching = (loading || isRefetching) && dataArrived;
  return (
    <div className="relative">
      {/* شريط تحديث شفاف في الأعلى — لا يحجب المحتوى */}
      {isBackgroundRefetching && (
        <div
          className="absolute top-0 left-0 right-0 h-0.5 z-50 overflow-hidden rounded-full"
          aria-hidden="true"
        >
          <div className="h-full bg-indigo-500 animate-[shimmer_1.2s_ease-in-out_infinite] origin-left" />
        </div>
      )}
      {children}
    </div>
  );
}
