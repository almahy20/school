import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Users, GraduationCap, UserCheck, School, LogOut, BookOpen, ClipboardList, CalendarCheck, Settings, X, MessageSquare
} from 'lucide-react';

const adminLinks = [
  { to: '/', label: 'لوحة التحكم', icon: LayoutDashboard },
  { to: '/messages', label: 'بث الرسائل', icon: MessageSquare },
  { to: '/students', label: 'إدارة الطلاب', icon: Users },
  { to: '/teachers', label: 'إدارة المعلمين', icon: GraduationCap },
  { to: '/parents', label: 'أولياء الأمور', icon: UserCheck },
  { to: '/classes', label: 'الفصول الدراسية', icon: School },
  { to: '/settings', label: 'الإعدادات العامة', icon: Settings },
];

const teacherLinks = [
  { to: '/', label: 'لوحة التحكم', icon: LayoutDashboard },
  { to: '/students', label: 'طلابي', icon: Users },
  { to: '/classes', label: 'فصولي', icon: School },
  { to: '/grades', label: 'الدرجات والتقييم', icon: ClipboardList },
  { to: '/attendance', label: 'سجل الحضور', icon: CalendarCheck },
  { to: '/settings', label: 'الإعدادات', icon: Settings },
];

const parentLinks = [
  { to: '/', label: 'متابعة الأبناء', icon: Users },
  { to: '/settings', label: 'الإعدادات', icon: Settings },
];

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const links = user?.role === 'admin' ? adminLinks
    : user?.role === 'teacher' ? teacherLinks
    : parentLinks;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const roleLabel = user?.role === 'admin' ? 'مدير النظام'
    : user?.role === 'teacher' ? 'معلم'
    : 'ولي أمر';

  return (
    <aside className="h-screen w-72 bg-primary flex flex-col shadow-2xl relative z-50">
      {/* Sidebar Decor */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-5 pointer-events-none" />
      
      <div className="p-8 relative">
        <div className="flex items-center gap-4 group cursor-pointer">
          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center shadow-lg shadow-black/20 transition-all group-hover:scale-110 group-hover:rotate-3 border border-white/10">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">إدارة عربية</h1>
            <span className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em] block">S C H O O L</span>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden absolute top-8 left-8 p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="px-8 py-6 flex items-center gap-4 mb-2">
        <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/5 flex items-center justify-center text-white text-lg font-black shadow-inner">
          {user?.fullName?.[0] || '?'}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black text-white truncate">{user?.fullName}</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">{roleLabel}</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto custom-scrollbar relative">
        {links.map(link => (
          <NavLink key={link.to} to={link.to} end={link.to === '/'}
            onClick={onClose}
            className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : 'nav-item-inactive'} transition-all group`}>
            {({ isActive }) => (
              <>
                <link.icon className={`w-5 h-5 transition-all group-hover:scale-110 ${isActive ? 'text-white' : 'text-white/40 group-hover:text-white'}`} />
                <span className={`tracking-tight ${isActive ? 'font-black' : 'font-bold'}`}>{link.label}</span>
                {isActive && <div className="mr-auto w-1.5 h-1.5 rounded-full bg-secondary" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-6 mt-auto">
        <button onClick={handleLogout} className="flex items-center gap-3 w-full px-5 py-4 rounded-2xl bg-white/5 text-white/60 hover:bg-destructive hover:text-white transition-all group font-bold text-sm">
          <LogOut className="w-5 h-5 transition-transform group-hover:translate-x-[-4px]" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  );
}
