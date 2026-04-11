import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import {
  Bell, Globe, HelpCircle, Shield,
  Users, Database, LogOut, Edit2, Plus, ArrowLeft,
  Smartphone, CheckCircle2, Info, Settings2, Palette
} from 'lucide-react';
import SchoolBrandingSettings from '@/components/admin/SchoolBrandingSettings';
import { useToast } from '@/hooks/use-toast';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { 
  useProfile, 
  useUpdateNotificationPrefs, 
  useUpdateMyProfile 
} from '@/hooks/queries';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import { Button } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isSubscribed, subscribeToNotifications } = usePushNotifications();
  
  const { data: profile, isLoading, error, refetch } = useProfile();
  const updatePrefsMutation = useUpdateNotificationPrefs();

  const [pref, setPref] = useState({
    attendance: true,
    grades: true,
    messages: true,
    fees: true,
    system: true
  });

  useEffect(() => {
    if (profile?.notification_prefs) {
      setPref(profile.notification_prefs as any);
    }
  }, [profile]);

  const handleUpdatePref = async (key: keyof typeof pref, val: boolean) => {
    const newPref = { ...pref, [key]: val };
    setPref(newPref);
    try {
      await updatePrefsMutation.mutateAsync(newPref);
    } catch (err) {
      console.error('Error updating prefs:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      // Navigation is handled by ProtectedRoute after user state changes
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout failed:', error);
      // Force navigation even if logout fails
      navigate('/login', { replace: true });
    }
  };

  const roleLabel = profile?.role === 'admin' ? 'مدير النظام' : profile?.role === 'teacher' ? 'معلم' : 'ولي أمر';
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 md:gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1200px] mx-auto text-right pb-20 px-2 md:px-0">
        <header className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-200">
                <Settings2 className="w-6 h-6" />
             </div>
             <h1 className="text-3xl font-black text-slate-900 tracking-tight">إعدادات المنظومة والتحكم</h1>
          </div>
          <p className="text-sm text-slate-400 font-medium tracking-wide pr-1">إدارة حسابك الشخصي، هوية المؤسسة، وتفضيلات التواصل الرقمي.</p>
        </header>

        <QueryStateHandler
          loading={isLoading}
          error={error}
          data={profile}
          onRetry={refetch}
          loadingMessage="جاري مزامنة تفضيلاتك..."
          emptyMessage="تعذر جلب ملفك الشخصي حالياً."
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Left Column: Profile & Navigation */}
            <div className="lg:col-span-4 space-y-8 order-2 lg:order-1">
               <div className="bg-white border border-slate-100 p-10 rounded-[48px] shadow-xl shadow-slate-100/50 flex flex-col items-center gap-6 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                  
                  <div className="relative">
                    <div className="w-32 h-32 rounded-[40px] bg-slate-900 flex items-center justify-center text-4xl font-black text-white shadow-2xl transition-all group-hover:rotate-3 duration-500">
                      {profile?.full_name?.[0] || '?'}
                    </div>
                    <button className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-white text-indigo-600 shadow-xl flex items-center justify-center hover:scale-110 transition-all">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="text-center">
                    <h2 className="text-xl font-black text-slate-900 tracking-tight mb-2">{profile?.full_name}</h2>
                    <Badge className="bg-indigo-50 text-indigo-600 font-black text-[9px] uppercase tracking-widest px-4 py-1 rounded-full border-none mb-4">
                      {roleLabel}
                    </Badge>
                    <p className="text-xs font-bold text-slate-300 tracking-tighter" dir="ltr">{profile?.phone}</p>
                  </div>

                  <button className="w-full h-14 mt-4 rounded-2xl bg-slate-50 text-slate-600 text-xs font-black hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center justify-center gap-3 group">
                    <Edit2 className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                    تعديل الملف الشخصي
                  </button>
               </div>

               <div className="space-y-4">
                 <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] pr-4">إدارة الدعم والمنظومة</h3>
                 <div className="bg-white border border-slate-100 rounded-[40px] overflow-hidden shadow-sm divide-y divide-slate-50">
                    {[
                      { label: 'مركز المساعدة', icon: HelpCircle, onClick: () => window.open('https://wa.me/201029082772', '_blank') },
                      { label: 'سياسة الخصوصية', icon: Shield, onClick: () => {} },
                      { label: 'لغة المنظومة', icon: Globe, extra: 'العربية (افتراضي)', onClick: () => {} },
                    ].map((item) => (
                      <button
                        key={item.label}
                        onClick={item.onClick}
                        className="w-full flex items-center gap-5 p-6 hover:bg-slate-50/50 transition-all group"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center shrink-0 border border-slate-50 group-hover:bg-slate-900 group-hover:text-white transition-all">
                          <item.icon className="w-5 h-5 text-slate-300 group-hover:text-white transition-colors" />
                        </div>
                        <div className="flex-1 text-right">
                          <span className="block text-sm font-black text-slate-700">{item.label}</span>
                          {item.extra && <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-1 block">{item.extra}</span>}
                        </div>
                        <ArrowLeft className="w-4 h-4 text-slate-100 group-hover:text-slate-900 transition-all" />
                      </button>
                    ))}
                 </div>
               </div>

               <button
                  onClick={handleLogout}
                  className="w-full h-16 rounded-[32px] bg-slate-900 text-white font-black text-sm flex items-center justify-center gap-3 hover:bg-rose-600 transition-all shadow-2xl shadow-slate-200 active:scale-95 group"
                >
                  <LogOut className="w-5 h-5 transition-transform group-hover:rotate-12" />
                  تسجيل الخروج الآمن
                </button>
            </div>

            {/* Right Column: Settings Sections */}
            <div className="lg:col-span-8 space-y-12 order-1 lg:order-2">
               {/* Institutional Branding (Admin Only) */}
               {profile?.role === 'admin' && (
                 <div className="animate-in slide-in-from-top-4 duration-500">
                    <SchoolBrandingSettings />
                 </div>
               )}

               {/* Notifications */}
               <div className="space-y-6">
                 <div className="flex items-center justify-between pr-2">
                    <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">تفضيلات الإشعارات والتواصل</h3>
                    <div className="flex items-center gap-2">
                       <CheckCircle2 className={cn("w-4 h-4", isSubscribed ? "text-emerald-500" : "text-slate-200")} />
                       <span className="text-[9px] font-black uppercase text-slate-400">نظام PWA مفعل</span>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-indigo-600 p-8 rounded-[40px] shadow-2xl shadow-indigo-100 flex flex-col justify-between text-white group h-full">
                       <div className="space-y-4">
                          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shadow-lg">
                             <Bell className="w-7 h-7" />
                          </div>
                          <div>
                             <h4 className="text-xl font-black mb-1">الإشعارات الفورية</h4>
                             <p className="text-xs font-medium text-indigo-100 leading-relaxed">استلم التحديثات، الدرجات، والرسائل الهامة مباشرة على شاشة قفل هاتفك في الوقت الفعلي.</p>
                          </div>
                       </div>
                       
                       {!isSubscribed ? (
                         <button onClick={subscribeToNotifications} className="mt-8 h-12 bg-white text-indigo-600 font-bold text-xs rounded-xl hover:scale-105 active:scale-95 transition-all shadow-xl">تفعيل الآن</button>
                       ) : (
                         <div className="mt-8 flex items-center gap-2 text-[10px] font-bold text-emerald-300 bg-black/10 w-fit px-4 py-2 rounded-lg">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            الخدمة تعمل بنجاح
                         </div>
                       )}
                    </div>

                    <div className="bg-white border border-slate-100 rounded-[40px] overflow-hidden shadow-sm divide-y divide-slate-50">
                      {[
                        { id: 'attendance', label: 'الحضور والغياب', desc: 'إشعار فوري عند رصد غياب الطالب' },
                        { id: 'grades', label: 'الدرجات والتقييم', desc: 'تنبيهات رصد النتائج والشهادات' },
                        { id: 'messages', label: 'المراسلات الإدارية', desc: 'رسائل الإدارة والتعميمات العامة' },
                        { id: 'fees', label: 'المطالبات المالية', desc: 'تنبيهات السداد وفواتير المصروفات' }
                      ].map((item) => (
                        <div key={item.id} className="p-6 flex items-center justify-between gap-4">
                          <div className="flex-1">
                             <span className="block text-sm font-black text-slate-700">{item.label}</span>
                             <span className="text-[10px] font-medium text-slate-400 mt-0.5 block">{item.desc}</span>
                          </div>
                          <Switch 
                            checked={(pref as any)[item.id]} 
                            onCheckedChange={(val) => handleUpdatePref(item.id as any, val)} 
                          />
                        </div>
                      ))}
                    </div>
                 </div>
               </div>

               {/* Access Level (Admin Only Highlights) */}
               {profile?.role === 'admin' && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <button onClick={() => navigate('/users')} className="p-10 rounded-[40px] bg-slate-900 text-white flex flex-col justify-between group hover:scale-[1.02] transition-all shadow-2xl shadow-slate-200 h-64">
                       <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center transition-all group-hover:rotate-6">
                          <Users className="w-7 h-7 text-indigo-400" />
                       </div>
                       <div className="text-right">
                          <h4 className="text-2xl font-black mb-1">إدارة الكوادر</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">التحكم في المعلمين وأولياء الأمور</p>
                       </div>
                    </button>
                    <button onClick={() => navigate('/database')} className="p-10 rounded-[40px] bg-white border border-slate-100 flex flex-col justify-between group hover:scale-[1.02] transition-all shadow-xl shadow-slate-100 h-64">
                       <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center transition-all group-hover:rotate-6">
                          <Database className="w-7 h-7 text-slate-300 group-hover:text-slate-900 transition-colors" />
                       </div>
                       <div className="text-right">
                          <h4 className="text-2xl font-black text-slate-900 mb-1">مركز البيانات</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">التحكم المباشر في سجلات النظام</p>
                       </div>
                    </button>
                 </div>
               )}
            </div>
          </div>
        </QueryStateHandler>
        
        <div className="text-center p-14 bg-slate-50 rounded-[48px] border border-slate-100 mt-10 relative overflow-hidden">
           <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
           <div className="relative z-10 space-y-6">
              <div className="w-16 h-16 bg-white rounded-3xl shadow-xl flex items-center justify-center mx-auto border border-slate-100">
                 <div className="w-8 h-8 rounded-xl bg-indigo-600/20" />
              </div>
              <div>
                 <p className="text-[11px] font-black text-slate-400 tracking-[0.3em] uppercase mb-2">EDARA ARABIYA SYSTEM</p>
                 <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest leading-relaxed">النسخة السحابية v3.1.0 • تم التحديث في 2025<br/>نظام التعليم الذكي الموحد</p>
              </div>
           </div>
        </div>
      </div>
    </AppLayout>
  );
}
