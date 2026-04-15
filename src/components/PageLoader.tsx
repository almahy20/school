import { BookOpen } from "lucide-react";

export const PageLoader = () => {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0a0f1e] overflow-hidden" dir="rtl">
      {/* Background Glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-10 animate-in fade-in zoom-in duration-1000">
        <div className="relative group">
          {/* Animated Rings */}
          <div className="absolute inset-[-20px] border border-white/5 rounded-full animate-[spin_10s_linear_infinite]" />
          <div className="absolute inset-[-40px] border border-white/5 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
          
          <div className="relative w-28 h-28 bg-white/5 backdrop-blur-3xl rounded-[35px] flex items-center justify-center border border-white/10 shadow-[0_0_50px_rgba(99,102,241,0.1)]">
            <BookOpen className="w-12 h-12 text-indigo-400" />
            
            {/* Inner Glow */}
            <div className="absolute inset-0 bg-indigo-500/10 rounded-[35px] blur-xl animate-pulse" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-6 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white tracking-[.2em] uppercase">النظام الذكي</h1>
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.5em]">Edara Arabiya Platform</p>
          </div>
          
          <div className="relative w-48 h-[2px] bg-white/5 rounded-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent w-full animate-[loading_2s_infinite_ease-in-out]" />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};
