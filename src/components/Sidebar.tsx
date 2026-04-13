import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUnreadNotificationsCount, useBranding } from '@/hooks/queries';
import { 
  LucideIcon, LayoutDashboard, Users, GraduationCap, UserCheck, 
  School, LogOut, BookOpen, CalendarCheck, 
  Settings, X, MessageSquare, ChevronLeft, ShieldAlert, 
  Bell, Layers, CreditCard, Send, Home, Database
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface SidebarLink {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: 'notifications';
}

const adminLinks: SidebarLink[] = [
  { to: '/', label: 'لوحة التحكم', icon: LayoutDashboard },
  { to: '/messages', label: 'بث الرسائل', icon: Send },
  { to: '/manage-complaints', label: 'الشكاوى والمقترحات', icon: MessageSquare, badge: 'notifications' },
  { to: '/students', label: 'إدارة الطلاب', icon: Users },
  { to: '/teachers', label: 'إدارة المعلمين', icon: GraduationCap },
  { to: '/parents', label: 'أولياء الأمور', icon: UserCheck },
  { to: '/classes', label: 'الفصول الدراسية', icon: School },
  { to: '/attendance', label: 'سجل الحضور', icon: CalendarCheck },
  { to: '/fees', label: 'المصروفات', icon: CreditCard },
  { to: '/settings', label: 'الإعدادات العامة', icon: Settings },
];

const superAdminLinks: SidebarLink[] = [
  { to: '/super-admin', label: 'إدارة المدارس', icon: ShieldAlert },
  { to: '/manage-complaints', label: 'الشكاوى والمقترحات', icon: MessageSquare },
  { to: '/messages', label: 'بث الرسائل', icon: Send },
  { to: '/settings', label: 'إعدادات المنصة', icon: Settings },
];

const teacherLinks: SidebarLink[] = [
  { to: '/', label: 'لوحة التحكم', icon: LayoutDashboard },
  { to: '/students', label: 'طلابي', icon: Users },
  { to: '/classes', label: 'فصولي', icon: School },
  { to: '/attendance', label: 'سجل الحضور', icon: CalendarCheck },
  { to: '/settings', label: 'الإعدادات', icon: Settings },
];

const parentLinks: SidebarLink[] = [
  { to: '/', label: 'الرئيسية', icon: Home },
  { to: '/complaints', label: 'الشكاوى', icon: MessageSquare, badge: 'notifications' },
  { to: '/settings', label: 'الإعدادات', icon: Settings },
];

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: initialUnreadCount = 0 } = useUnreadNotificationsCount();
  const { data: branding } = useBranding();
  const [unreadCount, setUnreadCount] = useState(0);
  const [logoError, setLogoError] = useState(false);

  const schoolBranding = useMemo(() => {
    const timestamp = Date.now();
    const logo = branding?.logo_url || '';
    const logoWithCacheBust = logo ? (logo.includes('?') ? `${logo}&v=${timestamp}` : `${logo}?v=${timestamp}`) : '';
    
    return {
      name: branding?.name || 'المدرسة الذكية',
      logo: logoWithCacheBust,
    };
  }, [branding]);

  useEffect(() => {
    setLogoError(false); // Reset error when branding changes
  }, [branding]);

  useEffect(() => {
    setUnreadCount(initialUnreadCount);
  }, [initialUnreadCount]);

  const getLinks = () => {
    if (user?.isSuperAdmin) return superAdminLinks;
    if (user?.role === 'admin') return adminLinks;
    if (user?.role === 'teacher') return teacherLinks;
    return parentLinks;
  };

  const links = getLinks();

  const handleLogout = async () => {
    try {
      await logout();
      // Navigation is handled by ProtectedRoute after user state changes
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout failed:', error);
      // Force navigation even if logout fails
      navigate('/login', { replace: true });
    }
  };

  const roleLabel = user?.isSuperAdmin ? 'المشرف العام'
    : user?.role === 'admin' ? 'مدير النظام'
    : user?.role === 'teacher' ? 'معلم ممارس'
    : 'ولي أمر معتمد';

  return (
    <aside className="h-full w-72 bg-slate-900 flex flex-col relative z-[90] border-l border-white/5 shadow-2xl overflow-hidden text-right">
      {/* Premium Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.08),transparent)] pointer-events-none" />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none" />
      
      {/* Mobile Close Button */}
      <div className="lg:hidden absolute top-4 left-4 z-[100]">
        <button onClick={onClose} className="p-2.5 rounded-xl bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all border border-white/5">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Brand Section */}
      <div className="p-6 pb-4 relative flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center border border-white/10 shadow-2xl shadow-indigo-500/20 rotate-3 hover:rotate-0 transition-all duration-500 shrink-0 group overflow-hidden bg-indigo-600">
          {schoolBranding.logo && !logoError ? (
            <img 
              src={schoolBranding.logo} 
              alt="School Logo" 
              className="w-full h-full object-contain group-hover:scale-110 transition-transform"
              onError={() => setLogoError(true)}
            />
          ) : (
            <BookOpen className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
          )}
        </div>
        <div className="min-w-0 flex-1">
           <h1 className="text-base font-black text-white tracking-tight leading-none mb-1 truncate">{schoolBranding.name}</h1>
           <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">Smart Education</p>
        </div>
      </div>

      {/* User Section */}
      <div className="px-4 py-4">
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-3xl relative group overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-white text-lg font-black border border-white/10 shadow-inner group-hover:scale-105 transition-transform shrink-0">
              {user?.fullName?.[0] || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-white truncate leading-none mb-1.5">{user?.fullName}</p>
              <div className="flex items-center gap-1.5">
                 <span className="inline-flex px-2 py-0.5 rounded-md bg-white/10 text-[8px] font-black uppercase tracking-wider border border-white/10 text-indigo-400">
                   {roleLabel}
                 </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto scrollbar-hide flex flex-col justify-start pt-2 pb-4">
        {links.map(link => (
          <NavLink 
            key={link.to} 
            to={link.to} 
            end={link.to === '/'}
            onClick={onClose}
            className={({ isActive }) => cn(
              "flex items-center justify-between px-4 h-12 rounded-xl transition-all duration-300 group text-right whitespace-nowrap relative overflow-hidden",
              isActive 
                ? "bg-gradient-to-l from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/20" 
                : "text-white/50 hover:text-white hover:bg-white/[0.05]"
            )}
          >
            {({ isActive }) => (
              <>
                <div className="flex items-center gap-3 relative z-10">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300",
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-white/5 text-white/40 group-hover:bg-white/10 group-hover:text-white/70"
                  )}>
                    <link.icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold tracking-tight">{link.label}</span>
                </div>
                
                {link.badge === 'notifications' && unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-rose-500 text-white text-[8px] font-black shadow-lg shadow-rose-500/20 relative z-10">
                    {unreadCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout Footer */}
      <div className="p-4 border-t border-white/5 bg-white/[0.01]">
        <button 
          onClick={handleLogout}
          className="w-full h-11 rounded-xl flex items-center justify-center gap-2 text-rose-400 hover:text-white hover:bg-rose-500/20 transition-all duration-300 font-bold text-xs group"
        >
          <LogOut className="w-4 h-4 group-hover:rotate-12 transition-transform" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  );
}
