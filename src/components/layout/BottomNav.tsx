import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Home, MessageSquare, Calendar, CreditCard, User, CheckSquare, Settings, ShieldAlert, Users, School, BookOpen, Send, CalendarCheck } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useUnreadCounts } from '@/hooks/queries';

export default function BottomNav() {
  const { user } = useAuth();
  const { isSubscribed } = usePushNotifications();
  const { data: unreadCounts } = useUnreadCounts();
  const unreadCount = unreadCounts?.unread || 0;
  const unreadComplaintsCount = unreadCounts?.complaints || 0;

  if (!user) {
    return null;
  }

  const adminLinks = [
    { to: '/', icon: Home, label: 'الرئيسية' },
    { to: '/messages', icon: Send, label: 'بث الرسائل' },
    { to: '/manage-complaints', icon: MessageSquare, label: 'الشكاوى' },
    { to: '/students', icon: Users, label: 'الطلاب' },
    { to: '/settings', icon: Settings, label: 'الإعدادات' },
  ];

  const superAdminLinks = [
    { to: '/super-admin', icon: ShieldAlert, label: 'المدارس' },
    { to: '/manage-complaints', icon: MessageSquare, label: 'الشكاوى' },
    { to: '/messages', icon: Send, label: 'الرسائل' },
    { to: '/settings', icon: Settings, label: 'الإعدادات' },
  ];

  const parentLinks = [
    { to: '/', icon: Home, label: 'الرئيسية' },
    { to: '/complaints', icon: MessageSquare, label: 'الشكاوى' },
    { to: '/settings', icon: Settings, label: 'الإعدادات' },
  ];

  // Teacher links
  const teacherLinks = [
    { to: '/', icon: Home, label: 'الرئيسية' },
    { to: '/classes', icon: School, label: 'فصولي' },
    { to: '/settings', icon: Settings, label: 'الإعدادات' },
  ];

  const getLinks = () => {
    if (user.isSuperAdmin) return superAdminLinks;
    if (user.role === 'admin') return adminLinks;
    if (user.role === 'teacher') return teacherLinks;
    return parentLinks;
  };

  const links = getLinks();

  const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

  return (
    <>
      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white/95 backdrop-blur-xl border-t border-slate-200/50 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-[90] safe-area-bottom" dir="rtl">
        <div className="flex items-center justify-around px-1 py-1.5 max-w-lg mx-auto">
          {links.map((link) => {
            const isComplaints = link.label === 'الشكاوى' || link.to === '/manage-complaints' || link.to === '/complaints';
            const badgeCount = isComplaints ? unreadComplaintsCount : 0;
            const hasBadge = badgeCount > 0;
            
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    "relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-1 px-0.5 transition-all duration-300",
                    isActive ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="relative">
                      <div className={cn(
                        "p-1.5 rounded-lg transition-all duration-300",
                        isActive ? "bg-indigo-600 text-white shadow-md shadow-indigo-300/50 scale-105" : "bg-transparent"
                      )}>
                        <link.icon className="w-4.5 h-4.5" strokeWidth={isActive ? 2.5 : 2} />
                      </div>
                      {hasBadge && (
                        <div className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center shadow-sm">
                          {badgeCount > 9 ? '9+' : badgeCount}
                        </div>
                      )}
                    </div>
                    <span className={cn(
                      "text-[9px] font-bold transition-all duration-300 truncate w-full text-center leading-tight mt-0.5",
                      isActive ? "text-indigo-600 font-extrabold" : "text-slate-500"
                    )}>
                      {link.label}
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>
    </>
  );
}
