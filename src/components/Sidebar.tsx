import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { playNotificationSound, sendLocalNotification } from '@/utils/notifications';
import { useUnreadNotificationsCount } from '@/hooks/queries';
import { 
  LucideIcon, LayoutDashboard, Users, GraduationCap, UserCheck, 
  School, LogOut, BookOpen, ClipboardList, CalendarCheck, 
  Settings, X, MessageSquare, ChevronLeft, ShieldAlert, 
  Bell, Layers, CreditCard, Send, Home
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  { to: '/curriculum-management', label: 'إدارة المناهج', icon: Layers },
  { to: '/grades', label: 'الدرجات والتقييم', icon: ClipboardList },
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
  { to: '/grades', label: 'الدرجات والتقييم', icon: ClipboardList },
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
  const { data: initialUnreadCount = 0, refetch } = useUnreadNotificationsCount();
  const [unreadCount, setUnreadCount] = useState(0);
  const defaultLogo = "https://mecutwhreywjwstirpka.supabase.co/storage/v1/object/public/branding/logo.png";
  const [schoolBranding, setSchoolBranding] = useState({ name: 'المدرسة الذكية', logo: defaultLogo, themeColor: '#1A3C8F' });

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        if (user?.schoolId) {
          const { data, error } = await supabase
            .from('schools')
            .select('name, logo_url, icon_url, theme_color')
            .eq('id', user.schoolId)
            .maybeSingle();

          if (error) {
            console.error('Error fetching branding:', error);
            return;
          }

          if (data) {
            const timestamp = Date.now();
            const logo = data.icon_url || data.logo_url || '';
            const logoWithCacheBust = logo ? (logo.includes('?') ? `${logo}&v=${timestamp}` : `${logo}?v=${timestamp}`) : '';
            
            setSchoolBranding({
              name: data.name,
              logo: logoWithCacheBust,
              themeColor: data.theme_color
            });
          }
        }
      } catch (err) {
        console.error('Fatal error in fetchBranding:', err);
      }
    };
    fetchBranding();

    // Listen for school branding updates
    const channel = supabase
      .channel('school-branding-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'schools',
          filter: user?.schoolId ? `id=eq.${user.schoolId}` : undefined
        },
        (payload) => {
          const newSchool = payload.new as any;
          
          const timestamp = Date.now();
          const logo = newSchool.icon_url || newSchool.logo_url || '';
          const logoWithCacheBust = logo ? (logo.includes('?') ? `${logo}&v=${timestamp}` : `${logo}?v=${timestamp}`) : '';
          
          setSchoolBranding({
            name: newSchool.name,
            logo: logoWithCacheBust,
            themeColor: newSchool.theme_color
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.schoolId]);

  useEffect(() => {
    setUnreadCount(initialUnreadCount);
  }, [initialUnreadCount]);

  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;

    const channel = supabase
      .channel(`sidebar-notifications-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, 
      (payload) => {
        if (isMounted) {
          setUnreadCount(prev => prev + 1);
          
          // Show local browser notification with school branding
          sendLocalNotification(
            schoolBranding.name, 
            payload.new.content || 'لديك إشعار جديد',
            schoolBranding.logo
          );
          
          refetch(); // Keep React Query in sync
        }
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id, refetch, schoolBranding]);

  const getLinks = () => {
    if (user?.isSuperAdmin) return superAdminLinks;
    if (user?.role === 'admin') return adminLinks;
    if (user?.role === 'teacher') return teacherLinks;
    return parentLinks;
  };

  const links = getLinks();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
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
      <div className="lg:hidden absolute top-6 left-6 z-[100]">
        <button onClick={onClose} className="p-3 rounded-2xl bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all border border-white/5">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Brand Section */}
      <div className="p-10 pb-6 relative flex items-center gap-4">
        <div className="w-12 h-12 rounded-[18px] flex items-center justify-center border border-white/10 shadow-2xl shadow-indigo-500/20 rotate-3 hover:rotate-0 transition-all duration-500 shrink-0 group overflow-hidden" style={{ backgroundColor: schoolBranding.themeColor || '#1A3C8F' }}>
          {schoolBranding.logo ? (
            <img 
              src={schoolBranding.logo} 
              alt="School Logo" 
              className="w-full h-full object-contain group-hover:scale-110 transition-transform"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                setSchoolBranding(prev => ({ ...prev, logo: '' }));
              }}
            />
          ) : (
            <BookOpen className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
          )}
        </div>
        <div className="min-w-0">
           <h1 className="text-xl font-black text-white tracking-tight leading-none mb-1.5 truncate">{schoolBranding.name}</h1>
           <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.25em]">Smart Education</p>
        </div>
      </div>

      {/* User Section */}
      <div className="px-6 py-8">
        <div className="p-5 rounded-[28px] bg-white/5 border border-white/5 backdrop-blur-3xl relative group overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-white text-2xl font-black border border-white/10 shadow-inner group-hover:scale-105 transition-transform shrink-0">
              {user?.fullName?.[0] || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-white truncate leading-none mb-2">{user?.fullName}</p>
              <div className="flex items-center gap-2">
                 <span className="inline-flex px-2.5 py-1 rounded-lg bg-white/10 text-[9px] font-black uppercase tracking-widest border border-white/10" style={{ color: schoolBranding.themeColor || '#1A3C8F' }}>
                   {roleLabel}
                 </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-5 space-y-2 overflow-y-auto custom-scrollbar flex flex-col justify-start pt-2 pb-8">
        {links.map(link => (
          <NavLink 
            key={link.to} 
            to={link.to} 
            end={link.to === '/'}
            onClick={onClose}
            className={({ isActive }) => cn(
              "flex items-center justify-between px-6 h-14 rounded-[22px] transition-all duration-500 group text-right whitespace-nowrap relative overflow-hidden",
              isActive 
                ? "bg-white text-slate-900 shadow-2xl" 
                : "text-white/30 hover:text-white hover:bg-white/[0.03]"
            )}
            style={({ isActive }) => isActive ? { boxShadow: `0 20px 25px -5px ${schoolBranding.themeColor || '#1A3C8F'}20` } : {}}
          >
            <div className="flex items-center gap-4 relative z-10">
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-500",
                "group-hover:scale-110",
                "bg-white/5 text-white/40 group-[.active]:text-white"
              )} style={{ backgroundColor: location.pathname === link.to || (link.to === '/' && location.pathname === '/') ? schoolBranding.themeColor || '#1A3C8F' : undefined }}>
                <link.icon className="w-4.5 h-4.5" />
              </div>
              <span className="text-xs font-black tracking-tight">{link.label}</span>
            </div>
            
            {link.badge === 'notifications' && unreadCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-rose-500 text-white text-[9px] font-black shadow-lg shadow-rose-500/20 animate-pulse relative z-10">
                {unreadCount}
              </span>
            )}
            
            <ChevronLeft className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-[.active]:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0 relative z-10" />
          </NavLink>
        ))}
      </nav>

      {/* Logout Footer */}
      <div className="p-6 border-t border-white/5 bg-white/[0.01]">
        <button 
          onClick={handleLogout}
          className="w-full h-14 rounded-[22px] flex items-center justify-center gap-3 text-rose-400 hover:text-white hover:bg-rose-500 transition-all duration-500 font-black text-xs group shadow-lg hover:shadow-rose-500/20"
        >
          <LogOut className="w-4.5 h-4.5 group-hover:rotate-12 transition-transform" />
          <span>تسجيل الخروج الآمن</span>
        </button>
      </div>
    </aside>
  );
}
