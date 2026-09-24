import { useEffect, useState, useRef } from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { RefreshCw, CheckCircle2, Wifi, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function GlobalSyncIndicator() {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const isBusy = isFetching > 0 || isMutating > 0;

  const [isSlow, setIsSlow] = useState(false);
  const [isVerySlow, setIsVerySlow] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const slowTimerRef = useRef<NodeJS.Timeout | null>(null);
  const verySlowTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevBusyRef = useRef(false);

  useEffect(() => {
    if (isBusy) {
      setShowSuccess(false);

      // تنبيه خفيف لو العملية استغرقت أكثر من 2.5 ثانية
      slowTimerRef.current = setTimeout(() => {
        setIsSlow(true);
      }, 2500);

      // تنبيه إضافي لو الشبكة بطيئة جداً (أكثر من 7 ثوانٍ)
      verySlowTimerRef.current = setTimeout(() => {
        setIsVerySlow(true);
      }, 7000);
    } else {
      // تم الانتهاء من الجلب
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      if (verySlowTimerRef.current) clearTimeout(verySlowTimerRef.current);

      if (prevBusyRef.current && (isSlow || isVerySlow)) {
        setIsSlow(false);
        setIsVerySlow(false);
        setShowSuccess(true);
        const t = setTimeout(() => {
          setShowSuccess(false);
        }, 2200);
        return () => clearTimeout(t);
      }

      setIsSlow(false);
      setIsVerySlow(false);
    }

    prevBusyRef.current = isBusy;

    return () => {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      if (verySlowTimerRef.current) clearTimeout(verySlowTimerRef.current);
    };
  }, [isBusy, isSlow, isVerySlow]);

  return (
    <>
      {/* 1. شريط تقدم علوي فائق النعومة عند أي نشاط شبكة */}
      {isBusy && (
        <div
          className="fixed top-0 left-0 right-0 h-1 z-[9999] pointer-events-none overflow-hidden bg-transparent"
          role="progressbar"
          aria-label="جاري مزامنة البيانات"
        >
          <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 animate-[shimmer_1.5s_infinite] origin-left shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
        </div>
      )}

      {/* 2. بطاقة تنبيه عائمة وذكية عند تأخر جلب البيانات من السيرفر */}
      {(isSlow || showSuccess) && (
        <div
          dir="rtl"
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[9990] flex items-center gap-3 px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 border"
          style={{
            backgroundColor: showSuccess
              ? 'rgba(16, 185, 129, 0.95)'
              : isVerySlow
              ? 'rgba(217, 119, 6, 0.95)'
              : 'rgba(15, 23, 42, 0.92)',
            borderColor: showSuccess
              ? 'rgba(52, 211, 153, 0.4)'
              : isVerySlow
              ? 'rgba(251, 191, 36, 0.4)'
              : 'rgba(99, 102, 241, 0.3)',
            color: '#FFFFFF',
          }}
        >
          {showSuccess ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-100 shrink-0 animate-bounce" />
              <span className="text-xs font-bold text-white tracking-wide">
                تم تحديث ومزامنة البيانات بنجاح ✓
              </span>
            </>
          ) : isVerySlow ? (
            <>
              <AlertTriangle className="w-4 h-4 text-amber-200 shrink-0 animate-pulse" />
              <span className="text-xs font-bold text-amber-50">
                الاتصال بالإنترنت بطيء — جاري استكمال جلب أحدث البيانات، يُرجى الانتظار...
              </span>
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 text-indigo-300 shrink-0 animate-spin" />
              <span className="text-xs font-bold text-white">
                جاري جلب أحدث البيانات من السيرفر... يرجى الانتظار لحين اكتمال التحميل
              </span>
            </>
          )}
        </div>
      )}
    </>
  );
}
