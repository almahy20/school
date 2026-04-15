import { useState, ReactNode, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from './Sidebar';
import { Menu, BookOpen, Bell, Search, User, ChevronLeft, ShieldAlert, Smartphone, CheckCircle2, Zap } from 'lucide-react';
import { GlobalAnnouncement } from './GlobalAnnouncement';
import { GlobalSyncIndicator } from './GlobalSyncIndicator';
import BottomNav from './layout/BottomNav';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Button } from './ui/button';
import { useToast } from "@/hooks/use-toast";
import { useUnreadNotificationsCount, useBranding } from '@/hooks/queries';

interface Props {
  children: ReactNode;
}

export default function AppLayout({ children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: unreadCount = 0 } = useUnreadNotificationsCount();
  const { data: branding } = useBranding();
  const [logoError, setLogoError] = useState(false);
  const hasBottomNav = user?.role === 'teacher' || user?.role === 'parent';

  const schoolBranding = useMemo(() => {
    const timestamp = Date.now();
    const logo = branding?.logo_url || '';
    const logoWithCacheBust = logo ? (logo.includes('?') ? `${logo}&v=${timestamp}` : `${logo}?v=${timestamp}`) : '';

    return {
      name: branding?.name || 'المدرسة الذكية',
      logo: logoWithCacheBust,
      themeColor: '#1A3C8F'
    };
  }, [branding]);

  useEffect(() => {
    setLogoError(false);
  }, [branding]);

  // Handle mandatory setup for ALL roles (PWA, Notifications)
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
  const { permission } = usePushNotifications();

  // Show a non-blocking toast reminder if user is in browser but already logged in
  useEffect(() => {
    if (user && !isPWA) {
      // Logic for PWA reminder could go here if needed in future
    }
  }, [user, isPWA]);

  // Quick navigation search
  const allLinks = useMemo(() => {
    const links = [
      { to: '/', label: 'لوحة التحكم' },
      { to: '/students', label: 'الطلاب' },
      { to: '/teachers', label: 'المعلمون' },
      { to: '/parents', label: 'أولياء الأمور' },
      { to: '/classes', label: 'الفصول الدراسية' },
      { to: '/attendance', label: 'سجل الحضور' },
      { to: '/fees', label: 'المصروفات' },
      { to: '/messages', label: 'الرسائل' },
      { to: '/manage-complaints', label: 'الشكاوى' },
      { to: '/settings', label: 'الإعدادات' },
    ];
    return links.filter(l => searchQuery && l.label.includes(searchQuery));
  }, [searchQuery]);

  return (
    <div className="min-h-screen flex flex-col w-full font-cairo selection:bg-primary/20" dir="rtl">
      {/* Dynamic Background Noise/Texture */}
      <div className="fixed inset-0 bg-white opacity-[0.03] pointer-events-none z-0" />

      <GlobalAnnouncement />
      <GlobalSyncIndicator />


      {/* Mobile Glass Header */}
      <div className="lg:hidden flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-white/70 backdrop-blur-2xl border-b border-slate-100 sticky top-0 z-[60] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center text-white shadow-lg overflow-hidden bg-slate-900">
            {schoolBranding.logo && !logoError ? (
              <img
                src={schoolBranding.logo}
                alt="School Logo"
                className="w-full h-full object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </div>
          <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 truncate max-w-[150px] sm:max-w-[200px]">{schoolBranding.name}</span>
        </div>
        {/* Hide sidebar button for teachers and parents who have BottomNav */}
        {user?.role !== 'teacher' && user?.role !== 'parent' && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2.5 sm:p-3 rounded-2xl bg-white text-slate-900 hover:bg-slate-50 transition-all active:scale-95 border border-slate-100 shadow-sm"
          >
            <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        )}
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] lg:hidden animate-in fade-in duration-500"
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

      {/* Main Content Area */}
      <main className="lg:mr-72 min-h-screen flex flex-col bg-[#F8FAFC] transition-all duration-700 relative">
        {/* Abstract Background Gradients (Enhanced for better visual consistency) */}
        <div className="absolute top-[-5%] right-[-5%] w-[60%] h-[60%] bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none animate-pulse duration-[10s]" />
        <div className="absolute bottom-[-5%] left-[-5%] w-[50%] h-[50%] bg-violet-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[15s]" />

        {/* Desktop Header Navigation */}
        <div className="hidden lg:flex items-center justify-between px-10 xl:px-12 py-4 xl:py-6 relative z-50 sticky top-0 bg-[#F8FAFC]/90 backdrop-blur-2xl border-b border-slate-200/50">
          <div className="flex items-center gap-4">
            <div className="p-1 px-4 xl:px-5 rounded-full text-[9px] xl:text-[10px] font-black uppercase tracking-[0.2em] border bg-white text-slate-500 border-slate-200 shadow-sm">
              نظام الإدارة الذكي — {schoolBranding.name}
            </div>
          </div>

          <div className="flex items-center gap-4 xl:gap-6">
            <div className="flex items-center gap-2 p-2 rounded-2xl bg-white border border-slate-200 shadow-sm px-4 xl:px-5 h-11 xl:h-12 group focus-within:ring-8 focus-within:ring-indigo-500/5 transition-all relative">
              <Search className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
              <input
                type="text"
                placeholder="بحث سريع عن الطلاب أو المعلمين..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none text-xs font-bold placeholder:text-slate-300 focus:outline-none w-48 xl:w-64 text-slate-900"
              />

              {/* Search Results Dropdown */}
              {allLinks.length > 0 && (
                <div className="absolute top-full right-0 left-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[100] animate-in fade-in slide-in-from-top-2">
                  {allLinks.map(link => (
                    <button
                      key={link.to}
                      onClick={() => {
                        navigate(link.to);
                        setSearchQuery('');
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 text-right group transition-all"
                    >
                      <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900" style={{ color: schoolBranding.themeColor || '#1A3C8F' }}>{link.label}</span>
                      <ChevronLeft className="w-4 h-4 text-slate-200 group-hover:text-slate-900" style={{ color: schoolBranding.themeColor || '#1A3C8F' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div
              onClick={() => navigate('/notifications')}
              className="w-10 h-10 xl:w-12 xl:h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all cursor-pointer shadow-sm relative hover:scale-105 active:scale-95 group"
            >
              <Bell className="w-4 h-4 xl:w-5 xl:h-5 group-hover:rotate-12 transition-transform" style={{ color: schoolBranding.themeColor || '#1A3C8F' }} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-4 xl:h-5 rounded-full bg-rose-500 text-white text-[9px] xl:text-[10px] font-black flex items-center justify-center px-1 border-2 border-white shadow-lg animate-in zoom-in">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>

            <div className="h-8 w-px bg-slate-200/50 mx-2" />

            <div className="flex items-center gap-3 p-1.5 pl-5 rounded-2xl bg-slate-900 text-white shadow-xl shadow-indigo-900/10 group cursor-pointer hover:translate-y-[-2px] transition-all h-12">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 group-hover:bg-white/20 transition-colors">
                <User className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] hidden xl:block">حسابي الشخصي</span>
            </div>
          </div>
        </div>

        {/* Content Section - Flex-1 to push footer down */}
        <div className="flex-1 w-full px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10 py-4 sm:py-6 animate-in fade-in slide-in-from-bottom-4 duration-1000 relative z-10">
          {children}
        </div>

        {/* Sticky Footer */}
        <footer className={cn(
          "py-6 px-4 sm:px-6 md:px-8 lg:px-10 xl:px-16 relative z-10 border-t border-slate-200/50 bg-[#F8FAFC]/90 backdrop-blur-2xl mt-auto",
          hasBottomNav ? "pb-24 sm:pb-12" : "pb-8"
        )}>
          <div className="flex mb-20 md:mb-0  flex-col md:flex-row items-center justify-between gap-6 md:gap-8 max-w-[1400px] mx-auto">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center shadow-inner border border-white overflow-hidden">
                {schoolBranding.logo ? (
                  <img src={schoolBranding.logo} alt="Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <BookOpen className="w-6 h-6 text-slate-400" />
                )}
              </div>
              <div>
                <p className="text-sm font-black text-slate-900 leading-none mb-1">{schoolBranding.name}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">منصة التعليم المتكاملة</p>
              </div>
            </div>

            <div className="text-center md:text-right">
              <p className="text-sm font-black text-slate-900 border-b-2 border-indigo-500/20 pb-1 inline-block"> تطوير: عبدالرحمن سيد فوزي </p>
              <p className="text-[10px] font-bold text-slate-300 tracking-[0.3em] mt-3"> جميع الحقوق محفوظة © {new Date().getFullYear()} </p>
            </div>
          </div>
        </footer>
      </main>

      <BottomNav />
    </div>
  );
}
