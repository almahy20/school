import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import {
  ChevronLeft, User, Bell, Globe, HelpCircle, Shield,
  Users, Database, LogOut, Edit2, Plus
} from 'lucide-react';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const roleLabel = user?.role === 'admin' ? 'مدير النظام' : user?.role === 'teacher' ? 'معلم' : 'ولي أمر';

  const accountSettings = [
    { label: 'إعدادات الملف الشخصي', icon: User, onClick: () => {} },
    { label: 'تفضيلات الإشعارات', icon: Bell, onClick: () => {} },
    { label: 'لغة التطبيق', icon: Globe, extra: 'العربية', onClick: () => {} },
  ];

  const supportSettings = [
    { label: 'مركز المساعدة', icon: HelpCircle, onClick: () => {} },
    { label: 'سياسة الخصوصية', icon: Shield, onClick: () => {} },
  ];

  const adminSettings = [
    { label: 'إدارة المستخدمين', icon: Users, onClick: () => navigate('/users') },
    { label: 'إدارة قاعدة البيانات', icon: Database, onClick: () => navigate('/database') },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col gap-10 animate-fade-in max-w-4xl mx-auto">
        <div className="text-center">
          <h1 className="page-header mb-2 inline-block">إعدادات النظام</h1>
          <p className="text-muted-foreground text-sm">إدارة حسابك وتخصيص تجربة التطبيق الخاصة بك.</p>
        </div>

        {/* Profile Card */}
        <div className="bg-card rounded-3xl border shadow-lg p-8 flex flex-col sm:flex-row items-center gap-8 group animate-scale-in relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-primary/10 transition-colors" />
          
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl bg-primary/10 border-4 border-card flex items-center justify-center text-4xl font-black text-primary shadow-xl transition-transform group-hover:scale-105 group-hover:rotate-3">
              {user?.fullName?.[0] || '?'}
            </div>
            <button className="absolute -bottom-2 -left-2 w-10 h-10 rounded-2xl bg-card border shadow-lg flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all active:scale-90">
              <Plus className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 text-center sm:text-right">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
              <h2 className="text-2xl font-black text-foreground">{user?.fullName}</h2>
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold tracking-widest uppercase self-center sm:self-auto">
                {roleLabel}
              </span>
            </div>
            <p className="text-muted-foreground font-medium mb-4">{user?.phone || user?.email}</p>
            <button className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-muted text-foreground text-sm font-bold hover:bg-primary hover:text-white transition-all active:scale-95 shadow-sm">
              <Edit2 className="w-4 h-4" /> تعديل الملف الشخصي
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="flex items-center gap-3 px-2">
              <User className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-black text-muted-foreground uppercase tracking-[0.2em]">إعدادات الحساب</h3>
            </div>
            <div className="bg-card rounded-3xl border shadow-sm overflow-hidden divide-y">
              {accountSettings.map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className="w-full flex items-center gap-5 p-5 hover:bg-primary/5 transition-all text-right group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center shrink-0 transition-all group-hover:bg-primary/10 group-hover:scale-110">
                    <item.icon className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex-1">
                    <span className="block font-bold text-foreground group-hover:text-primary transition-colors">{item.label}</span>
                    {item.extra && <span className="text-xs text-muted-foreground font-medium">{item.extra}</span>}
                  </div>
                  <ChevronLeft className="w-5 h-5 text-muted-foreground/30 group-hover:translate-x-[-4px] group-hover:text-primary transition-all" />
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 px-2">
              <HelpCircle className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-black text-muted-foreground uppercase tracking-[0.2em]">الدعم والمساعدة</h3>
            </div>
            <div className="bg-card rounded-3xl border shadow-sm overflow-hidden divide-y">
              {supportSettings.map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className="w-full flex items-center gap-5 p-5 hover:bg-primary/5 transition-all text-right group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center shrink-0 transition-all group-hover:bg-primary/10 group-hover:scale-110">
                    <item.icon className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <span className="flex-1 font-bold text-foreground group-hover:text-primary transition-colors">{item.label}</span>
                  <ChevronLeft className="w-5 h-5 text-muted-foreground/30 group-hover:translate-x-[-4px] group-hover:text-primary transition-all" />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {user?.role === 'admin' && (
              <>
                <div className="flex items-center gap-3 px-2">
                  <Shield className="w-5 h-5 text-primary" />
                  <h3 className="text-sm font-black text-muted-foreground uppercase tracking-[0.2em]">أدوات المسؤول</h3>
                </div>
                <div className="bg-card rounded-3xl border shadow-sm overflow-hidden divide-y">
                  {adminSettings.map((item) => (
                    <button
                      key={item.label}
                      onClick={item.onClick}
                      className="w-full flex items-center gap-5 p-5 hover:bg-primary/5 transition-all text-right group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center shrink-0 transition-all group-hover:bg-primary/10 group-hover:scale-110">
                        <item.icon className="w-6 h-6 text-primary" />
                      </div>
                      <span className="flex-1 font-bold text-foreground group-hover:text-primary transition-colors">{item.label}</span>
                      <ChevronLeft className="w-5 h-5 text-primary/30 group-hover:translate-x-[-4px] group-hover:text-primary transition-all" />
                    </button>
                  ))}
                </div>
              </>
            )}

            <button
              onClick={handleLogout}
              className="w-full py-5 rounded-3xl bg-destructive/10 text-destructive font-black text-lg flex items-center justify-center gap-3 hover:bg-destructive hover:text-white transition-all shadow-lg shadow-destructive/10 active:scale-95 group"
            >
              <LogOut className="w-6 h-6 transition-transform group-hover:scale-110 group-hover:rotate-12" />
              تسجيل الخروج من النظام
            </button>
            
            <div className="text-center p-8 bg-muted/30 rounded-3xl border border-dashed border-border/50">
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 border overflow-hidden">
                <img src="/favicon.ico" alt="Logo" className="w-8 h-8 opacity-20" />
              </div>
              <p className="text-xs font-black text-muted-foreground/40 tracking-widest uppercase mb-1">إدارة عربية</p>
              <p className="text-[10px] font-bold text-muted-foreground/30">الإصدار 2.5.0 (2025) · كافة الحقوق محفوظة</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
