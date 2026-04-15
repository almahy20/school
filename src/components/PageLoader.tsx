import { BookOpen } from "lucide-react";

export const PageLoader = () => {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0a0f1e] overflow-hidden" dir="rtl">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-8 animate-in fade-in duration-1000">
        <div className="relative">
          {/* Animated Rings */}
          <div className="absolute inset-0 w-24 h-24 border-4 border-indigo-500/20 rounded-[35%] animate-[spin_8s_linear_infinite]" />
          <div className="absolute inset-0 w-24 h-24 border-4 border-violet-500/20 rounded-[40%] animate-[spin_12s_linear_infinite_reverse]" />
          
          <div className="relative w-24 h-24 bg-white/5 backdrop-blur-2xl rounded-[30px] flex items-center justify-center border border-white/10 shadow-2xl">
            <BookOpen className="w-10 h-10 text-indigo-400 animate-pulse" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-xl font-black text-white tracking-widest uppercase">الماحي للبرمجة — النظام الذكي</h1>
          <div className="flex items-center gap-1.5 h-1 w-48 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500 w-[40%] animate-[shimmer_2s_infinite_linear]" 
              style={{ backgroundSize: '200% 100%' }}
            />
          </div>
          <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Integrated School Platform</p>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(250%); }
          100% { transform: translateX(-250%); }
        }
      `}</style>
    </div>
  );
};
