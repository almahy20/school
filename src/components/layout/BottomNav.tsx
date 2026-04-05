import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Home, MessageSquare, Calendar, CreditCard, User, CheckSquare, BarChart2, Settings, ShieldAlert } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function BottomNav() {
  const { user } = useAuth();
  const { isSubscribed } = usePushNotifications(); // Move this up

  // لا يظهر للمدير، يظهر فقط للمعلم وولي الأمر
  if (!user || user.role === 'admin' || user.isSuperAdmin) {
    return null;
  }

  const parentLinks = [
    { to: '/', icon: Home, label: 'الرئيسية' },
    { to: '/complaints', icon: MessageSquare, label: 'الشكاوى' },
    { to: '/settings', icon: Settings, label: 'الإعدادات' },
  ];

  const teacherLinks = [
    { to: '/', icon: Home, label: 'الرئيسية' },
    { to: '/attendance', icon: Calendar, label: 'الحضور' },
    { to: '/grades', icon: BarChart2, label: 'الدرجات' },
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

      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-slate-100 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-[90] pb-safe" dir="rtl">
        <div className="flex items-center justify-around px-2 py-3">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-1 w-16 transition-all duration-300",
                  isActive ? "text-indigo-600 scale-110" : "text-slate-400 hover:text-slate-600 hover:scale-105"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className={cn(
                    "p-2.5 rounded-full transition-colors duration-300",
                    isActive ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "bg-transparent text-slate-400"
                  )}>
                    <link.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className={cn(
                    "text-[10px] font-black transition-colors duration-300",
                    isActive ? "text-indigo-600" : "text-slate-400"
                  )}>
                    {link.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </>
  );
}
