import { useState, ReactNode } from 'react';
import Sidebar from './Sidebar';
import { Menu, BookOpen, Bell, Search, User } from 'lucide-react';
import { GlobalAnnouncement } from './GlobalAnnouncement';
import { cn } from '@/lib/utils';

export default function AppLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row font-cairo selection:bg-primary/20 overflow-x-hidden" dir="rtl">
      <GlobalAnnouncement />

      {/* Mobile Glass Header */}
      <div className="lg:hidden flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-xl border-b border-white/50 sticky top-0 z-[60] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <BookOpen className="w-4 h-4" />
          </div>
          <span className="text-xl font-black tracking-tight text-slate-900">إدارة عربية</span>
        </div>
        <button 
          onClick={() => setSidebarOpen(true)}
          className="p-2.5 rounded-xl bg-slate-50 text-slate-900 hover:bg-slate-100 transition-all active:scale-95 border border-slate-200 shadow-inner"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/10 backdrop-blur-[8px] z-[70] lg:hidden animate-in fade-in duration-700" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Fixed Desktop Sidebar Container */}
      <aside className={cn(
        "fixed inset-y-0 right-0 w-72 z-[80] transition-all duration-700 ease-out transform shadow-2xl lg:translate-x-0 bg-slate-900",
        sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
      )}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </aside>

      {/* Main Content Area - Shifted for fixed sidebar on desktop */}
      <main className="flex-1 min-w-0 min-h-screen relative flex flex-col bg-slate-50/50 lg:mr-72">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 w-full h-[600px] bg-gradient-to-b from-primary/[0.03] to-transparent pointer-events-none" />
        
        {/* Desktop Header Navigation (Scaled Down) */}
        <div className="hidden lg:flex items-center justify-end px-10 py-6 gap-6 relative z-50">
           <div className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-100 shadow-sm px-4 h-10">
              <Search className="w-3.5 h-3.5 text-slate-300" />
              <input type="text" placeholder="بحث سريع..." className="bg-transparent border-none text-[10px] font-black placeholder:text-slate-300 focus:outline-none w-28" />
           </div>
           <div className="w-9 h-9 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-primary transition-colors cursor-pointer shadow-sm relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-rose-500 rounded-full border-2 border-white" />
           </div>
           <div className="h-6 w-px bg-slate-100 mx-1" />
           <div className="flex items-center gap-2 p-1 pr-3 rounded-xl bg-slate-900 text-white shadow-xl shadow-slate-200 group cursor-pointer hover:translate-y-[-1px] transition-all h-9">
              <span className="text-[9px] font-black uppercase tracking-widest hidden xl:block">نسخة بريميوم</span>
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                 <User className="w-3.5 h-3.5" />
              </div>
           </div>
        </div>

        {/* Scaled Padding for Main Content */}
        <div className="flex-1 w-full p-6 sm:p-8 lg:p-12 animate-in fade-in slide-in-from-bottom-2 duration-1000 relative z-10 overflow-x-hidden">
          {children}
        </div>
        
        {/* Scaled Footer */}
        <footer className="py-8 px-10 text-center relative z-10 border-t border-slate-100 bg-white/50 backdrop-blur-sm mt-auto">
          <div className="flex flex-col items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-1 shadow-inner">
                <BookOpen className="w-5 h-5 text-slate-400" />
             </div>
             <p className="text-[11px] font-black text-slate-400 tracking-widest uppercase mb-1"> Edara Arabiya — Smart School Management </p>
             <p className="text-sm font-black text-slate-900 border-b-2 border-primary/20 pb-1"> تطوير: عبدالرحمن سيد فوزي </p>
             <p className="text-[9px] font-bold text-slate-300 tracking-[0.4em] mt-2"> نظام الإدارة الذكية © {new Date().getFullYear()} </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
