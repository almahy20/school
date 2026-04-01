import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Users, GraduationCap, UserCheck, School, LogOut, BookOpen, ClipboardList, CalendarCheck, Settings, X, MessageSquare, ChevronLeft, ShieldAlert
} from 'lucide-react';
import { cn } from '@/lib/utils';

const adminLinks = [
  { to: '/', label: 'لوحة التحكم', icon: LayoutDashboard },
  { to: '/messages', label: 'بث الرسائل', icon: MessageSquare },
  { to: '/manage-complaints', label: 'الشكاوى من أولياء الأمور', icon: MessageSquare },
  { to: '/students', label: 'إدارة الطلاب', icon: Users },
  { to: '/teachers', label: 'إدارة المعلمين', icon: GraduationCap },
  { to: '/parents', label: 'أولياء الأمور', icon: UserCheck },
  { to: '/classes', label: 'الفصول الدراسية', icon: School },
  { to: '/attendance', label: 'سجل الحضور', icon: CalendarCheck },
  { to: '/fees', label: 'المصروفات', icon: ClipboardList },
  { to: '/settings', label: 'الإعدادات العامة', icon: Settings },
];

const superAdminLinks = [
  { to: '/super-admin', label: 'إدارة المدارس المركزية', icon: ShieldAlert },
  { to: '/manage-complaints', label: 'شكاوى مديري المدارس', icon: MessageSquare },
  { to: '/messages', label: 'بث الرسائل', icon: MessageSquare },
  { to: '/settings', label: 'إعدادات المنصة', icon: Settings },
];

const teacherLinks = [
  { to: '/', label: 'لوحة التحكم', icon: LayoutDashboard },
  { to: '/students', label: 'طلابي', icon: Users },
  { to: '/classes', label: 'فصولي', icon: School },
  { to: '/grades', label: 'الدرجات والتقييم', icon: ClipboardList },
  { to: '/settings', label: 'الإعدادات', icon: Settings },
];

const parentLinks = [
  { to: '/', label: 'متابعة الأبناء', icon: Users },
  { to: '/complaints', label: 'الشكاوى', icon: MessageSquare },
  { to: '/settings', label: 'الإعدادات', icon: Settings },
];

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
      {/* Dynamic Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.02),transparent)] pointer-events-none" />
      
      {/* Mobile Close Button */}
      <div className="lg:hidden absolute top-4 left-4 z-[100]">
        <button onClick={onClose} className="p-2 rounded-lg bg-white/5 text-white/40 hover:text-white transition-all">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Brand Section (Scaled Down) */}
      <div className="p-8 pb-4 relative flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 shadow-2xl backdrop-blur-md rotate-3 group-hover:rotate-0 transition-all duration-500 shrink-0">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
           <h1 className="text-lg font-black text-white tracking-tight leading-none mb-1">إدارة عربية</h1>
           <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">Smart Education</p>
        </div>
      </div>

      {/* User Section (Scaled Down) */}
      <div className="px-5 py-6">
        <div className="p-4 rounded-[24px] bg-white/5 border border-white/5 backdrop-blur-xl relative group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-white text-xl font-black border border-white/10 group-hover:bg-white/20 transition-all shrink-0">
              {user?.fullName?.[0] || '?'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-white truncate leading-none mb-1.5">{user?.fullName}</p>
              <span className="inline-flex px-2 py-0.5 rounded-full bg-white/5 text-[9px] font-black text-white/30 uppercase tracking-widest border border-white/5">
                {roleLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation (Premium Scaling) */}
      <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar flex flex-col justify-start pt-1 pb-4">
        {links.map(link => (
          <NavLink 
            key={link.to} 
            to={link.to} 
            end={link.to === '/'}
            onClick={onClose}
            className={({ isActive }) => cn(
              "flex items-center justify-between px-6 h-14 rounded-[20px] transition-all duration-500 group text-right whitespace-nowrap overflow-hidden",
              isActive 
                ? "bg-white text-slate-900 shadow-xl shadow-white/5" 
                : "text-white/30 hover:text-white hover:bg-white/5"
            )}
          >
            {({ isActive }) => (
              <>
                <div className="flex items-center gap-3.5">
                  <link.icon className={cn("w-5 h-5 shrink-0 transition-transform group-hover:scale-110", isActive ? "text-slate-900" : "text-white/20 group-hover:text-white")} />
                  <span className="text-[14px] font-black tracking-tight">{link.label}</span>
                </div>
                {/* Active Indicator Dot */}
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all duration-500 scale-0",
                  isActive && "scale-100 bg-slate-900"
                )} />
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer / Logout */}
      <div className="p-6 mt-auto border-t border-white/5">
        <button 
          onClick={handleLogout} 
          className="flex items-center justify-center gap-3 w-full h-14 rounded-[20px] bg-white/5 text-white/30 hover:bg-rose-500/10 hover:text-rose-400 transition-all text-xs font-black uppercase tracking-widest border border-white/5"
        >
          <LogOut className="w-5 h-5" />
          <span>إنهاء الجلسة</span>
        </button>
        <p className="text-[10px] font-black text-white/5 text-center mt-4 tracking-[0.3em] uppercase">V 3.0 PREMIUM</p>
      </div>
    </aside>
  );
}
