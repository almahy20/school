import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Home, MessageSquare, Settings, ShieldAlert, Users, School, ClipboardList } from 'lucide-react';
import { useUnreadCounts } from '@/hooks/queries';
import { useUnreadConversationsParentCount } from '@/hooks/queries/useConversations';

export default function BottomNav() {
  const { user } = useAuth();
  const { data: unreadCounts } = useUnreadCounts();
  const unreadComplaintsCount = unreadCounts?.complaints || 0;
  const { data: unreadConversations = 0 } = useUnreadConversationsParentCount();

  if (!user) return null;

  const adminLinks = [
    { to: '/',                     label: 'الرئيسية',   icon: Home        },
    { to: '/manage-conversations', label: 'الرسائل',    icon: MessageSquare, badge: unreadComplaintsCount },
    { to: '/students',             label: 'الطلاب',     icon: Users       },
    { to: '/settings',             label: 'الإعدادات',  icon: Settings    },
  ];

  const superAdminLinks = [
    { to: '/super-admin',          label: 'المدارس',   icon: ShieldAlert  },
    { to: '/manage-conversations', label: 'الرسائل',   icon: MessageSquare, badge: 0 },
    { to: '/settings',             label: 'الإعدادات', icon: Settings     },
  ];

  const parentLinks = [
    { to: '/',              label: 'الرئيسية',  icon: Home         },
    { to: '/conversations', label: 'التواصل',   icon: MessageSquare, badge: unreadConversations },
    { to: '/exams',         label: 'الاختبارات', icon: ClipboardList },
    { to: '/settings',      label: 'الإعدادات', icon: Settings     },
  ];

  const teacherLinks = [
    { to: '/',        label: 'الرئيسية',  icon: Home     },
    { to: '/classes', label: 'فصولي',     icon: School   },
    { to: '/settings', label: 'الإعدادات', icon: Settings },
  ];

  const links =
    user.isSuperAdmin    ? superAdminLinks :
    user.role === 'admin'   ? adminLinks :
    user.role === 'teacher' ? teacherLinks :
    parentLinks;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 md:hidden bg-white/95 backdrop-blur-xl border-t border-slate-200/50 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-[90] safe-area-bottom no-print"
      dir="rtl"
    >
      <div className="flex items-center justify-around px-1 py-1.5 max-w-lg mx-auto">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) =>
              cn(
                'relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-1 px-0.5 transition-all duration-300',
                isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  <div className={cn(
                    'p-1.5 rounded-lg transition-all duration-300',
                    isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-300/50 scale-105' : 'bg-transparent'
                  )}>
                    <link.icon className="w-[18px] h-[18px]" strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  {!!link.badge && link.badge > 0 && (
                    <div className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 bg-rose-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center shadow-sm">
                      {link.badge > 9 ? '9+' : link.badge}
                    </div>
                  )}
                </div>
                <span className={cn(
                  'text-[9px] font-bold truncate w-full text-center leading-tight mt-0.5',
                  isActive ? 'text-indigo-600 font-extrabold' : 'text-slate-500'
                )}>
                  {link.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
