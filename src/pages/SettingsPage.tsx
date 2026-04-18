import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import {
  Bell, Globe, HelpCircle, Shield,
  Users, Database, LogOut, Edit2, Plus, ArrowLeft,
  Smartphone, CheckCircle2, Info, Settings2, Palette, Lock
} from 'lucide-react';
import SchoolBrandingSettings from '@/components/admin/SchoolBrandingSettings';
import { useToast } from '@/hooks/use-toast';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { 
  useProfile, 
  useUpdateNotificationPrefs, 
  useUpdateMyProfile 
} from '@/hooks/queries';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import { logger } from '@/utils/logger';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isSubscribed, subscribeToNotifications } = usePushNotifications();
  
  const { data: profile, isLoading, error, refetch } = useProfile();
  const updatePrefsMutation = useUpdateNotificationPrefs();
  const updateProfileMutation = useUpdateMyProfile();

  const [pref, setPref] = useState({
    attendance: true,
    grades: true,
    messages: true,
    fees: true,
    system: true
  });

  useEffect(() => {
    if (profile?.notification_prefs) {
      setPref(prev => ({ ...prev, ...(profile.notification_prefs as any) }));
    }
  }, [profile]);

  const handleUpdatePref = async (key: keyof typeof pref, val: boolean) => {
    const newPref = { ...pref, [key]: val };
    setPref(newPref);
    try {
      await updatePrefsMutation.mutateAsync(newPref);
    } catch (err) {
      logger.error('Error updating prefs:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (error) {
       navigate('/login', { replace: true });
    }
  };

  const roleLabel = profile?.role === 'admin' ? 'مدير النظام' : profile?.role === 'teacher' ? 'معلم' : 'ولي أمر';
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

  return (
    <AppLayout>
      <div className="page-wrapper">
        <header className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-200">
                <Settings2 className="w-6 h-6" />
             </div>
             <h1 className="text-3xl font-black text-slate-900 tracking-tight">إعدادات المنظومة والتحكم</h1>
          </div>
          <p className="text-sm text-slate-400 font-medium tracking-wide pr-1">إدارة حسابك الشخصي، هوية المؤسسة، وتفضيلات التواصل الرقمي.</p>
          {!user && <p className="text-[8px] text-red-500 uppercase">Warning: User context not loaded properly from useAuth</p>}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left Column */}
          <div className="lg:col-span-4 space-y-8 order-2 lg:order-1">
             <div className="bg-white border border-slate-100 p-10 rounded-[48px] shadow-xl shadow-slate-100/50 flex flex-col items-center gap-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="relative">
                  <div className="w-32 h-32 rounded-[40px] bg-slate-900 flex items-center justify-center text-4xl font-black text-white shadow-2xl transition-all group-hover:rotate-3 duration-500">
                    {profile?.full_name?.[0] || '?'}
                  </div>
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-black text-slate-900 tracking-tight mb-2">{profile?.full_name}</h2>
                  <Badge className="bg-indigo-50 text-indigo-600 font-black text-[9px] uppercase tracking-widest px-4 py-1 rounded-full border-none mb-4">
                    {roleLabel}
                  </Badge>
                  <p className="text-xs font-bold text-slate-300 tracking-tighter" dir="ltr">{profile?.phone}</p>
                </div>
             </div>

             <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] pr-4">إدارة الدعم والمنظومة</h3>
                <div className="bg-white border border-slate-100 rounded-[40px] overflow-hidden shadow-sm divide-y divide-slate-50">
                  <button onClick={() => window.open('https://wa.me/201029082772', '_blank')} className="w-full flex items-center gap-5 p-6 hover:bg-slate-50/50 transition-all group">
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center shrink-0 border border-slate-50 group-hover:bg-slate-900 group-hover:text-white transition-all">
                      <HelpCircle className="w-5 h-5 text-slate-300 group-hover:text-white" />
                    </div>
                    <span className="flex-1 text-right text-sm font-black text-slate-700">مركز المساعدة</span>
                    <ArrowLeft className="w-4 h-4 text-slate-100 group-hover:text-slate-900" />
                  </button>
                </div>
             </div>

             <button onClick={handleLogout} className="w-full h-16 rounded-[32px] bg-slate-900 text-white font-black text-sm flex items-center justify-center gap-3 hover:bg-rose-600 transition-all shadow-2xl shadow-slate-200 group">
                <LogOut className="w-5 h-5 transition-transform group-hover:rotate-12" />
                تسجيل الخروج الآمن
             </button>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-8 space-y-12 order-1 lg:order-2">
              {(user?.role === 'admin' || user?.isSuperAdmin) && (
                <div className="space-y-10">
                   <div className="flex items-center justify-between pr-2">
                      <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">هوية المؤسسة</h3>
                      <Badge className="bg-indigo-50 text-indigo-600 font-bold text-[8px] px-3">صلاحيات المدير</Badge>
                   </div>
                   <SchoolBrandingSettings />
                   
                   <div className="flex items-center justify-between pr-2 pt-4">
                      <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">إدارة المستخدمين</h3>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <button 
                        onClick={() => navigate('/users')} 
                        className="p-10 rounded-[48px] bg-slate-900 text-white flex flex-col justify-between group hover:scale-[1.02] transition-all h-64 relative overflow-hidden text-right shadow-2xl shadow-indigo-100"
                      >
                         <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
                         <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-4">
                            <Users className="w-7 h-7 text-indigo-300" />
                         </div>
                         <div>
                            <h4 className="text-2xl font-black mb-2">إدارة الكوادر التعليمية</h4>
                            <p className="text-xs font-medium text-slate-400">التحكم في المعلمين، الإداريين، وأولياء الأمور.</p>
                         </div>
                      </button>

                      <div className="p-10 rounded-[48px] bg-emerald-600 text-white flex flex-col justify-between group hover:scale-[1.02] transition-all h-64 relative overflow-hidden text-right shadow-2xl shadow-emerald-100">
                         <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
                            <Shield className="w-7 h-7" />
                         </div>
                         <div>
                            <h4 className="text-2xl font-black mb-2">أمان النظام</h4>
                            <p className="text-xs font-medium text-emerald-100">تحقق من سجلات الدخول وإشعارات الأمان.</p>
                         </div>
                      </div>
                   </div>
                </div>
              )}

              {/* Notifications & Personalization */}
              <div className="space-y-8 pt-6">
                 <div className="flex items-center justify-between pr-2">
                    <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">تفضيلات التواصل الشخصي</h3>
                    <div className="flex items-center gap-2">
                       <CheckCircle2 className={cn("w-4 h-4", isSubscribed ? "text-emerald-500" : "text-slate-200")} />
                       <span className="text-[9px] font-black uppercase text-slate-400">{isSubscribed ? 'التنبيهات مفعلة' : 'التنبيهات معطلة'}</span>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-1 gap-6">
                    <div className="bg-white border border-slate-100 p-10 rounded-[48px] shadow-xl shadow-slate-100/50 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group">
                       <div className="flex items-center gap-6">
                          <div className="w-16 h-16 rounded-3xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                             <Bell className="w-8 h-8" />
                          </div>
                          <div>
                             <h4 className="text-xl font-black text-slate-900 mb-1">إشعارات الجوال (Push Notifications)</h4>
                             <p className="text-sm font-medium text-slate-400">احصل على تنبيهات فورية عن الحضور، الدرجات، والرسائل.</p>
                          </div>
                       </div>
                       
                       {!isSubscribed ? (
                         <Button onClick={subscribeToNotifications} className="h-14 px-10 rounded-2xl bg-indigo-600 text-white font-black hover:scale-105 transition-all shadow-xl shadow-indigo-100">
                            تفعيل الآن
                         </Button>
                       ) : (
                         <Badge className="h-12 px-6 rounded-xl bg-emerald-50 text-emerald-600 font-black border-none">قيد التشغيل</Badge>
                       )}
                    </div>
                 </div>
              </div>
          </div>
        </div>

        <div className="text-center p-14 bg-slate-50 rounded-[48px] border border-slate-100 mt-10">
           <p className="text-[11px] font-black text-slate-400 tracking-[0.3em] uppercase">EDARA ARABIYA SYSTEM</p>
        </div>
      </div>
    </AppLayout>
  );
}
