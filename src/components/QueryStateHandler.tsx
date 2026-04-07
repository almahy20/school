import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface QueryStateHandlerProps {
  loading: boolean;
  error: any;
  data: any;
  onRetry: () => void;
  isRefetching?: boolean;
  errorMessage?: string;
  emptyMessage?: string;
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
  children,
  isEmpty = false,
}: QueryStateHandlerProps) {
  
  // 1. Loading State
  if (loading && !isRefetching) {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-6 animate-in fade-in duration-500">
        <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  // 2. Error State
  if (error) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-8 p-8 text-center bg-rose-50/30 rounded-[40px] border border-rose-100/50 animate-in fade-in zoom-in duration-500">
        <div className="w-20 h-20 rounded-[32px] bg-rose-50 flex items-center justify-center text-rose-500 shadow-inner border border-rose-100">
          <AlertCircle className="w-10 h-10" />
        </div>
        <div className="space-y-3 max-w-md">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">حدث خطأ في الاتصال</h2>
          <p className="text-slate-500 font-medium leading-relaxed">{errorMessage}</p>
        </div>
        <Button 
          onClick={onRetry}
          disabled={isRefetching}
          className="h-14 px-10 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-lg flex items-center gap-3 shadow-2xl shadow-slate-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <RefreshCw className={cn("w-5 h-5", isRefetching && "animate-spin")} />
          إعادة المحاولة الآن
        </Button>
      </div>
    );
  }

  // 3. Empty State (Optional)
  const isDataEmpty = isEmpty || (Array.isArray(data) && data.length === 0) || !data;
  
  if (isDataEmpty && !isRefetching) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-8 p-12 text-center bg-slate-50/50 rounded-[40px] border border-slate-100 animate-in fade-in duration-700">
        <div className="w-20 h-20 rounded-[32px] bg-white flex items-center justify-center text-slate-200 shadow-sm border border-slate-100">
          <AlertCircle className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">لا توجد بيانات</h2>
          <p className="text-slate-400 font-medium">{emptyMessage}</p>
        </div>
        <Button 
          onClick={onRetry}
          variant="ghost"
          className="text-indigo-600 font-bold hover:bg-indigo-50"
        >
          تحديث الصفحة
        </Button>
      </div>
    );
  }

  // 4. Success State (with optional refetching overlay if needed)
  return (
    <div className={cn("relative transition-opacity duration-300", isRefetching && "opacity-60 pointer-events-none")}>
      {children}
      {isRefetching && (
        <div className="absolute top-4 left-4 bg-white/80 backdrop-blur-md p-2 rounded-full border border-slate-200 shadow-sm flex items-center justify-center animate-in slide-in-from-top-2 duration-300 z-50">
          <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
        </div>
      )}
    </div>
  );
}
