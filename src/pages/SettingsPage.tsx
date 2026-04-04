import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import {
  ChevronLeft, User, Bell, Globe, HelpCircle, Shield,
  Users, Database, LogOut, Edit2, Plus, ArrowLeft
} from 'lucide-react';
import SchoolBrandingSettings from '@/components/admin/SchoolBrandingSettings';
import { useToast } from '@/hooks/use-toast';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isSubscribed, subscribeToPush } = usePushNotifications();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const roleLabel = user?.role === 'admin' ? 'مدير النظام' : user?.role === 'teacher' ? 'معلم' : 'ولي أمر';

  const accountSettings = [
    { label: 'إعدادات الملف الشخصي', icon: User, onClick: () => {} },
    { 
      label: isSubscribed ? 'الإشعارات مفعلة' : 'تفعيل الإشعارات الذكية', 
      icon: Bell, 
      onClick: subscribeToPush 
    },
    { label: 'لغة التطبيق', icon: Globe, extra: 'العربية', onClick: () => {} },
  ];

  const supportSettings = [
    { label: 'مركز المساعدة', icon: HelpCircle, onClick: () => window.open('https://wa.me/201029082772', '_blank') },
    { label: 'سياسة الخصوصية', icon: Shield, onClick: () => {} },
  ];

  const adminSettings = [
    { label: 'إدارة المستخدمين', icon: Users, onClick: () => navigate('/users') },
    { label: 'إدارة قاعدة البيانات', icon: Database, onClick: () => navigate('/database') },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1000px] mx-auto text-right">
        {/* Header Section */}
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">الإعدادات والتحكم</h1>
          <p className="text-sm text-slate-400 font-medium tracking-wide">إدارة الحساب الشخصي وتفضيلات النظام</p>
        </header>

        {/* Profile Card */}
        <div className="bg-white border border-slate-100 p-8 rounded-[40px] shadow-sm flex flex-col sm:flex-row items-center gap-8 relative overflow-hidden group">
          <div className="relative">
            <div className="w-28 h-28 rounded-3xl bg-slate-50 border border-slate-100 flex items-center justify-center text-3xl font-bold text-slate-300 shadow-inner group-hover:bg-primary group-hover:text-white transition-all duration-500">
              {user?.fullName?.[0] || '?'}
            </div>
            <button className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-white border border-slate-100 shadow-md flex items-center justify-center text-slate-400 hover:text-primary transition-all">
              <Plus className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 text-center sm:text-right">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{user?.fullName}</h2>
              <span className="px-3 py-1 rounded-lg bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-widest border border-primary/10 w-fit mx-auto sm:mx-0">
                {roleLabel}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-400 mb-6" dir="ltr">{user?.phone || user?.email}</p>
            <button className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-slate-700 text-xs font-bold border border-slate-100 hover:bg-slate-50 transition-all mx-auto sm:mx-0">
              <Edit2 className="w-4 h-4 text-slate-400" /> تعديل الملف الشخصي
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="flex flex-col gap-8">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest pr-2">تفضيلات الحساب</h3>
              <div className="bg-white border border-slate-100 rounded-[32px] overflow-hidden divide-y divide-slate-50 shadow-sm">
                {accountSettings.map((item) => (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    className="w-full flex items-center gap-4 p-6 hover:bg-slate-50/50 transition-all text-right group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-all">
                      <item.icon className="w-6 h-6 text-slate-300 group-hover:text-white transition-colors" />
                    </div>
                    <div className="flex-1">
                      <span className="block text-base font-bold text-slate-700 group-hover:text-primary transition-colors">{item.label}</span>
                      {item.extra && (
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-0.5 block">{item.extra}</span>
                      )}
                    </div>
                    <ArrowLeft className="w-4 h-4 text-slate-100 group-hover:text-primary group-hover:translate-x-[-4px] transition-all" />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest pr-2">الدعم والخصوصية</h3>
              <div className="bg-white border border-slate-100 rounded-[32px] overflow-hidden divide-y divide-slate-50 shadow-sm">
                {supportSettings.map((item) => (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    className="w-full flex items-center gap-4 p-6 hover:bg-slate-50/50 transition-all text-right group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-all">
                      <item.icon className="w-6 h-6 text-slate-300 group-hover:text-white transition-colors" />
                    </div>
                    <span className="flex-1 text-base font-bold text-slate-700 group-hover:text-primary transition-colors">{item.label}</span>
                    <ArrowLeft className="w-4 h-4 text-slate-100 group-hover:text-primary group-hover:translate-x-[-4px] transition-all" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-8">
            {user?.role === 'admin' && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest pr-2">إدارة النظام</h3>
                  <div className="bg-white border border-slate-100 rounded-[32px] overflow-hidden divide-y divide-slate-50 shadow-sm">
                    {adminSettings.map((item) => (
                      <button
                        key={item.label}
                        onClick={item.onClick}
                        className="w-full flex items-center gap-4 p-6 hover:bg-slate-50/50 transition-all text-right group"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-slate-900/5 flex items-center justify-center shrink-0 group-hover:bg-slate-900 group-hover:text-white transition-all">
                          <item.icon className="w-6 h-6 text-slate-400 group-hover:text-white transition-colors" />
                        </div>
                        <span className="flex-1 text-base font-bold text-slate-700 group-hover:text-slate-900 transition-colors">{item.label}</span>
                        <ArrowLeft className="w-4 h-4 text-slate-100 group-hover:text-slate-900 group-hover:translate-x-[-4px] transition-all" />
                      </button>
                    ))}
                  </div>
                </div>
                
                <SchoolBrandingSettings />
              </div>
            )}

            <button
              onClick={handleLogout}
              className="w-full py-6 rounded-[32px] bg-slate-900 text-white font-bold text-base flex items-center justify-center gap-3 hover:bg-rose-500 transition-all shadow-lg shadow-slate-900/10 active:scale-95 group"
            >
              <LogOut className="w-5 h-5 transition-transform group-hover:rotate-12" />
              تسجيل الخروج
            </button>
            
            <div className="text-center p-10 bg-slate-50 rounded-[40px] border border-slate-100">
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 border border-slate-200/50">
                <div className="w-6 h-6 rounded-lg bg-primary/20" />
              </div>
              <p className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase mb-1">EDARA ARABIYA</p>
              <p className="text-[9px] font-medium text-slate-300 uppercase tracking-widest leading-relaxed">الإصدار 2.5.0<br/>جميع الحقوق محفوظة © 2025</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
