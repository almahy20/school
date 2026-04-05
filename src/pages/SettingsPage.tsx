import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import {
  ChevronLeft, User, Bell, Globe, HelpCircle, Shield,
  Users, Database, LogOut, Edit2, Plus, ArrowLeft,
  Smartphone, CheckCircle2, XCircle
} from 'lucide-react';
import SchoolBrandingSettings from '@/components/admin/SchoolBrandingSettings';
import { useToast } from '@/hooks/use-toast';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isSubscribed, subscribeToNotifications, permission } = usePushNotifications();
  
  const [pref, setPref] = useState({
    attendance: true,
    grades: true,
    messages: true,
    fees: true,
    system: true
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.id) {
      supabase.from('profiles').select('notification_prefs').eq('id', user.id).single()
        .then(({ data }) => {
          if (data?.notification_prefs) {
            setPref(data.notification_prefs as any);
          }
        });
    }
  }, [user?.id]);

  const updatePref = async (key: keyof typeof pref, val: boolean) => {
    const newPref = { ...pref, [key]: val };
    setPref(newPref);
    if (user?.id) {
      await supabase.from('profiles').update({ notification_prefs: newPref }).eq('id', user.id);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const roleLabel = user?.role === 'admin' ? 'مدير النظام' : user?.role === 'teacher' ? 'معلم' : 'ولي أمر';

  const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

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

        {/* Notifications Status Section */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest pr-2">حالة النظام والتنبيهات</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div className="bg-white border border-slate-100 p-6 rounded-[32px] shadow-sm flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isPWA ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                   {isPWA ? <CheckCircle2 className="w-6 h-6" /> : <Smartphone className="w-6 h-6" />}
                </div>
                <div>
                   <p className="text-sm font-bold text-slate-900">تطبيق مثبت (PWA)</p>
                   <p className="text-[10px] font-medium text-slate-400">{isPWA ? 'يعمل النظام في وضع التطبيق المخصص' : 'يرجى تثبيت التطبيق لأفضل أداء'}</p>
                </div>
             </div>
             <div className="bg-white border border-slate-100 p-6 rounded-[32px] shadow-sm flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isSubscribed ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                   {isSubscribed ? <Bell className="w-6 h-6" /> : <Bell className="w-6 h-6" />}
                </div>
                <div className="flex-1">
                   <p className="text-sm font-bold text-slate-900">الإشعارات الفورية</p>
                   <p className="text-[10px] font-medium text-slate-400">{isSubscribed ? 'مفعلة وتصل في الخلفية' : 'غير مفعلة حالياً'}</p>
                </div>
                {!isSubscribed && (
                  <button onClick={subscribeToNotifications} className="px-4 py-2 bg-primary text-white text-[10px] font-bold rounded-xl shadow-lg shadow-primary/20">تفعيل</button>
                )}
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="flex flex-col gap-8">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest pr-2">تفضيلات التنبيهات</h3>
              <div className="bg-white border border-slate-100 rounded-[32px] overflow-hidden divide-y divide-slate-50 shadow-sm">
                {[
                  { id: 'attendance', label: 'تنبيهات الحضور والغياب', desc: 'استلام إشعار عند تسجيل غياب أو تأخر الطالب' },
                  { id: 'grades', label: 'تنبيهات الدرجات', desc: 'إشعار فوري عند رصد درجة جديدة أو تقييم' },
                  { id: 'messages', label: 'الرسائل والتعميمات', desc: 'تنبيهات الرسائل المباشرة من الإدارة والمعلمين' },
                  { id: 'fees', label: 'تنبيهات المصروفات', desc: 'إشعارات المطالبات المالية وسندات القبض' },
                  { id: 'system', label: 'تنبيهات النظام', desc: 'تحديثات هامة حول الحساب والمدرسة' }
                ].map((item) => (
                  <div key={item.id} className="p-6 flex items-center justify-between gap-4">
                    <div className="flex-1">
                       <span className="block text-base font-bold text-slate-700">{item.label}</span>
                       <span className="text-[10px] font-medium text-slate-400 mt-1 block">{item.desc}</span>
                    </div>
                    <Switch 
                      checked={(pref as any)[item.id]} 
                      onCheckedChange={(val) => updatePref(item.id as any, val)} 
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest pr-2">الدعم والخصوصية</h3>
              <div className="bg-white border border-slate-100 rounded-[32px] overflow-hidden divide-y divide-slate-50 shadow-sm">
                {[
                  { label: 'مركز المساعدة', icon: HelpCircle, onClick: () => window.open('https://wa.me/201029082772', '_blank') },
                  { label: 'سياسة الخصوصية', icon: Shield, onClick: () => {} },
                  { label: 'لغة التطبيق', icon: Globe, extra: 'العربية', onClick: () => {} },
                ].map((item) => (
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
          </div>

          <div className="flex flex-col gap-8">
            {user?.role === 'admin' && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest pr-2">إدارة النظام</h3>
                  <div className="bg-white border border-slate-100 rounded-[32px] overflow-hidden divide-y divide-slate-50 shadow-sm">
                    {[
                      { label: 'إدارة المستخدمين', icon: Users, onClick: () => navigate('/users') },
                      { label: 'إدارة قاعدة البيانات', icon: Database, onClick: () => navigate('/database') },
                    ].map((item) => (
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
