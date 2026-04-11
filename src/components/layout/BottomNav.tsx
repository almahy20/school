import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Home, MessageSquare, Calendar, CreditCard, User, CheckSquare, Settings, ShieldAlert, Users, School, BookOpen } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useUnreadNotificationsCount } from '@/hooks/queries';

export default function BottomNav() {
  const { user } = useAuth();
  const { isSubscribed } = usePushNotifications();
  const { data: unreadCount = 0 } = useUnreadNotificationsCount();

  // لا يظهر للمدير، يظهر فقط للمعلم وولي الأمر
  if (!user || user.role === 'admin' || user.isSuperAdmin) {
    return null;
  }

  const parentLinks = [
    { to: '/', icon: Home, label: 'الرئيسية' },
    { to: '/complaints', icon: MessageSquare, label: 'الشكاوى' },
    { to: '/settings', icon: Settings, label: 'الإعدادات' },
  ];

  // Teacher links - جميع الروابط التي كانت في Sidebar
  const teacherLinks = [
    { to: '/', icon: Home, label: 'الرئيسية' },
    { to: '/students', icon: Users, label: 'طلابي' },
    { to: '/classes', icon: School, label: 'فصولي' },
    { to: '/attendance', icon: Calendar, label: 'الحضور' },
    { to: '/settings', icon: Settings, label: 'الإعدادات' },
  ];

  const links = user.role === 'teacher' ? teacherLinks : parentLinks;

  const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

  return (
    <>
      {/* Mini notification banner for missing permissions */}
      {(!isPWA || !isSubscribed) && (
        <div className="fixed bottom-20 left-4 right-4 md:hidden z-[85] animate-in slide-in-from-bottom-2 duration-500">
          <div className="bg-amber-50 border border-amber-100 p-3 rounded-2xl flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <p className="text-[10px] font-bold text-amber-900">يرجى استكمال إعدادات النظام (التثبيت والتنبيهات)</p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 bg-amber-600 text-white text-[9px] font-black rounded-lg shadow-sm"
            >
              تفعيل الآن
            </button>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white/95 backdrop-blur-xl border-t border-slate-200/50 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-[90] safe-area-bottom" dir="rtl">
        <div className="flex items-center justify-around px-1 py-1.5 max-w-lg mx-auto">
          {links.map((link) => {
            const hasBadge = link.label === 'الشكاوى' && unreadCount > 0;
            
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
                          {unreadCount > 9 ? '9+' : unreadCount}
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
