import React from 'react';

/**
 * Enhanced global loader component that provides a polished, fluid loading experience 
 * while large lazy-loaded route chunks are imported over the network.
 */
export const PageLoader: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 w-full" dir="rtl">
      {/* Dynamic Pulse Animation Context */}
      <div className="relative flex flex-col items-center gap-6">
        {/* Animated Rings */}
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 w-16 h-16 border-4 border-indigo-100 rounded-full animate-ping opacity-75"></div>
          <div className="relative w-16 h-16 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin shadow-lg"></div>
          
          {/* Inner Core Element */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 bg-indigo-500 rounded-full animate-pulse"></div>
          </div>
        </div>

        {/* Text Area */}
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-xl font-bold tracking-tight text-slate-800 animate-pulse">جاري التحضير...</h2>
          <p className="text-sm text-slate-500 font-medium">نظام المدرسة الذكية</p>
        </div>
      </div>
    </div>
  );
};
