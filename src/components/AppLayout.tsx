import { useState, ReactNode } from 'react';
import Sidebar from './Sidebar';
import { Menu, BookOpen } from 'lucide-react';
import { GlobalAnnouncement } from './GlobalAnnouncement';

export default function AppLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row font-cairo" dir="rtl">
      <GlobalAnnouncement />

      {/* Scroll Progress Decor */}
      <div className="fixed top-0 right-0 left-0 h-1 bg-muted z-[100]">
        <div className="h-full bg-secondary transition-all" style={{ width: '0%' }} />
      </div>

      {/* Mobile Top Header */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-primary text-white shadow-lg relative z-[60]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shadow-md border border-white/10">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-black tracking-tight underline decoration-secondary decoration-2 underline-offset-4 pointer-events-none">إدارة عربية</span>
        </div>
        <button 
          onClick={() => setSidebarOpen(true)}
          className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all active:scale-95 shadow-sm border border-white/5"
        >
          <Menu className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-sm z-[70] lg:hidden animate-fade-in" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 right-0 w-72 z-[80] transition-all duration-500 transform lg:static lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : 'translate-x-full shadow-none'}
        ${sidebarOpen ? 'shadow-[0_0_50px_rgba(0,0,0,0.3)]' : ''}
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <main className="flex-1 min-w-0 min-h-screen relative overflow-x-hidden">
        {/* Background Subtle Pattern */}
        <div className="absolute inset-0 bg-[url('/dots.svg')] bg-[length:40px_40px] opacity-[0.03] pointer-events-none" />
        
        <div className="max-w-[1600px] mx-auto p-6 lg:p-10 animate-fade-in relative z-10">
          {children}
        </div>
        
        <footer className="py-12 px-6 border-t border-border/50 text-center relative z-10 bg-white/50 backdrop-blur-sm">
          <p className="text-[10px] font-black text-primary/30 uppercase tracking-[0.4em] mb-1">
            E D A R A · A R A B I Y A
          </p>
          <p className="text-[9px] font-bold text-primary/20 italic">The Intelligent School Management Suite</p>
        </footer>
      </main>
    </div>
  );
}
