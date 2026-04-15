import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowRight, User, Phone, Users, Info, 
  MapPin, Mail, Shield, ChevronLeft, CreditCard,
  Clock, Bell, CheckCircle, Send, Key
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  useParent, 
  useAdminParentChildren,
  useDeleteParent
} from '@/hooks/queries';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';

export default function ParentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [notificationStats, setNotificationStats] = useState<any>(null);
  const [parentLastSeen, setParentLastSeen] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  // ── Queries ──
  const { data: parent, isLoading: parentLoading, error: parentError, refetch: refetchParent } = useParent(id);
  const { data: children = [], isLoading: childrenLoading } = useAdminParentChildren(id);
  const deleteParentMutation = useDeleteParent();

  // Fetch notification stats and last_seen
  useEffect(() => {
    if (!id) return;

    const fetchParentData = async () => {
      // جلب last_seen من profiles
      const { data: profileData } = await supabase
        .from('profiles')
        .select('last_seen')
        .eq('id', id)
        .maybeSingle(); // ✅ maybeSingle بدل single — لا 404/406 لو لم يجده

      if (profileData?.last_seen) {
        setParentLastSeen(profileData.last_seen);
      }

      // جلب إحصائيات الإ捎عارات — الجدول موجود زي الكثيرين ما عندهم صف في notification_stats
      const { data: stats } = await supabase
        .from('notification_stats')
        .select('*')
        .eq('user_id', id)
        .maybeSingle(); // ✅ maybeSingle: يرجع null بدل 406 لو لم يوجد صف

      if (stats) {
        setNotificationStats(stats);
      }
    };

    fetchParentData();
  }, [id]);

  const handleDelete = async () => {
    if (!id || !window.confirm('هل أنت متأكد من حذف حساب ولي الأمر هذا؟ سيؤدي ذلك لإزالة صلاحياته بالكامل.')) return;
    try {
      await deleteParentMutation.mutateAsync(id);
      toast({ title: 'تم الحذف بنجاح', description: 'تمت إزالة ولي الأمر من النظام.' });
      navigate('/parents');
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim() || newPassword.length < 6) {
      toast({ title: 'خطأ', description: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل', variant: 'destructive' });
      return;
    }

    try {
      setResettingPassword(true);
      // 🚨 تحذير أمني: لا يمكنك استخدام auth.admin من المتصفح (Frontend Client).
      // منصة Supabase ترفض هذا بـ (403 Forbidden) لأنه يتطلب مفتاح Service Role الذي يمنع قطعيًا وضعه بالمتصفح.
      // 💡 الحل الصحيح: إنشاء Edge Function بداخل Supabase للقيام بهذا، أو توجيه المستخدم لاستعادة كلمة مروره بريدياً.
      
      toast({ 
        title: 'إجراء محظور أمنياً (403)', 
        description: 'لا يمكن تغيير كلمة المرور مباشرة من المتصفح لضمان أمان النظام. يرجى توجيه المستخدم لاستخدام ميزة "نسيت كلمة المرور" من شاشة الدخول.', 
      });
      
      console.warn("Blocked insecure client-side admin auth call (403 Forbidden). Requires Edge Function or RPC.");
      
      setNewPassword('');
      setShowPassword(false);
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message || 'فشل في إعادة تعيين كلمة المرور', variant: 'destructive' });
    } finally {
      setResettingPassword(false);
    }
  };

  const isLoadingTotal = parentLoading || childrenLoading;

  return (
    <AppLayout>
      <div className="main-content-standard animate-in fade-in slide-in-from-bottom-4 duration-700" dir="rtl">
        
        <QueryStateHandler
          loading={parentLoading}
          error={parentError}
          data={parent}
          onRetry={refetchParent}
          loadingMessage="جاري مزامنة بيانات حساب ولي الأمر..."
        >
          {/* Ultra-Premium Hero Banner */}
          <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-gradient-to-l from-slate-900 via-amber-950 to-slate-900 border-[0.5px] border-white/10 shadow-2xl p-8 md:p-12 rounded-[48px] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-amber-500/15 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none mix-blend-screen" />
            <div className="absolute bottom-0 left-0 w-[25rem] h-[25rem] bg-emerald-500/10 rounded-full blur-[80px] translate-y-1/3 -translate-x-1/3 pointer-events-none mix-blend-screen" />
            
            <div className="flex items-center gap-6 md:gap-8 relative z-10 w-full lg:w-2/3">
              <button 
                onClick={() => navigate('/parents')}
                className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-xl shrink-0 backdrop-blur-md"
              >
                 <ArrowRight className="w-5 h-5 md:w-7 md:h-7" />
              </button>
              
              <div className="flex items-center gap-5 md:gap-8 min-w-0">
                 <div className="w-16 h-16 md:w-24 md:h-24 rounded-[28px] md:rounded-[40px] bg-gradient-to-tr from-amber-500 to-orange-400 text-white flex items-center justify-center shadow-2xl shadow-amber-500/20 group-hover:rotate-6 transition-transform duration-700 shrink-0 border border-white/20">
                    <User className="w-8 h-8 md:w-12 md:h-12" />
                 </div>
                 <div className="space-y-2 min-w-0">
                    <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter drop-shadow-sm mb-1 truncate">{parent?.full_name}</h1>
                    <div className="flex items-center gap-3 flex-wrap">
                        {parentLastSeen && (
                          <Badge className={cn(
                            "border-none font-bold text-[10px] md:text-xs tracking-wide px-4 py-1.5 md:px-5 md:py-2 rounded-2xl backdrop-blur-md",
                            (new Date().getTime() - new Date(parentLastSeen).getTime() < 3 * 60 * 1000) 
                              ? "bg-emerald-500/20 text-emerald-300 animate-pulse" 
                              : "bg-white/5 text-white/50"
                          )}>
                            <div className={cn(
                              "w-2 h-2 rounded-full ml-2",
                              (new Date().getTime() - new Date(parentLastSeen).getTime() < 3 * 60 * 1000) 
                                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" 
                                : "bg-white/20"
                            )} />
                            {(new Date().getTime() - new Date(parentLastSeen).getTime() < 3 * 60 * 1000) 
                              ? "نشط الآن" 
                              : `آخر ظهور ${new Date(parentLastSeen).toLocaleDateString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`}
                          </Badge>
                        )}
                       <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-[10px] md:text-xs uppercase tracking-widest px-4 py-1.5 md:px-5 md:py-2 rounded-2xl backdrop-blur-md">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block ml-2" />
                          حساب معتمد
                       </Badge>
                       <Badge className="bg-white/10 text-white/70 border border-white/10 font-bold text-[10px] md:text-xs tracking-widest px-4 py-1.5 md:px-5 md:py-2 rounded-2xl backdrop-blur-md" dir="ltr">
                          #{parent?.id?.slice(0, 8)}
                       </Badge>
                    </div>
                 </div>
              </div>
            </div>

            <div className="flex items-center gap-4 relative z-10 w-full lg:w-auto lg:justify-end mt-4 lg:mt-0">
               <Button className="h-14 md:h-16 px-8 rounded-2xl bg-white text-slate-900 font-black gap-3 text-xs md:text-sm shadow-xl hover:bg-slate-50 transition-all">
                  <Mail className="w-4 h-4 md:w-5 md:h-5 text-amber-600" /> إرسال رسالة تنبيه
               </Button>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
            {/* Main Information Section */}
            <div className="lg:col-span-8 space-y-6 md:space-y-8">
                <section className="bg-white border border-slate-50 p-5 md:p-8 rounded-[28px] md:rounded-[40px] shadow-lg shadow-slate-100/50 space-y-6">
                   <header className="flex items-center gap-5 border-b border-slate-50 pb-6 md:pb-8">
                      <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-32 bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner shrink-0">
                         <Info className="w-6 h-6 md:w-8 md:h-8" />
                      </div>
                      <div>
                         <h2 className="text-lg md:text-2xl font-black text-slate-900 mb-1">بيانات التواصل المؤسسية</h2>
                         <p className="text-[9px] md:text-[11px] font-black text-slate-300 uppercase tracking-widest leading-none">إدارة قنوات التواصل الرسمي</p>
                      </div>
                   </header>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <ContactCard 
                        icon={Phone} 
                        label="رقم الهاتف الأساسي" 
                        value={parent?.phone || 'غير مسجل'} 
                        actionText="اتصال هاتفي"
                        color="indigo"
                      />
                      
                      {/* Password Card */}
                      <div className="p-8 rounded-[48px] flex flex-col justify-between h-64 border transition-all duration-500 hover:scale-[1.04] bg-slate-900 text-white shadow-3xl shadow-slate-200">
                         <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center shadow-inner">
                            <Key className="w-7 h-7" />
                         </div>
                         <div className="space-y-4">
                            <div>
                               <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2 text-white/40">كلمة المرور</p>
                               
                               {showPassword ? (
                                  <div className="space-y-3">
                                     <div className="relative">
                                        <input
                                          type="text"
                                          value={newPassword}
                                          onChange={(e) => setNewPassword(e.target.value)}
                                          placeholder="أدخل كلمة المرور الجديدة"
                                          className="w-full h-12 pr-4 pl-12 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 text-sm font-bold focus:outline-none focus:border-indigo-500 transition-colors"
                                          autoFocus
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setShowPassword(false);
                                            setNewPassword('');
                                          }}
                                          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                                        >
                                           <Key className="w-4 h-4 text-white/50" />
                                        </button>
                                     </div>
                                     <Button
                                       onClick={handleResetPassword}
                                       disabled={!newPassword || newPassword.length < 6 || resettingPassword}
                                       className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-lg disabled:opacity-50"
                                     >
                                       {resettingPassword ? 'جاري التحديث...' : 'حفظ كلمة المرور'}
                                     </Button>
                                     <p className="text-[9px] text-white/40 text-center font-bold">
                                        يجب أن تكون 6 أحرف على الأقل
                                     </p>
                                  </div>
                               ) : (
                                  <button
                                    onClick={() => setShowPassword(true)}
                                    className="w-full h-12 rounded-xl border-2 border-dashed border-white/20 hover:border-indigo-500/50 hover:bg-white/5 flex items-center justify-center gap-2 transition-all text-white/30 hover:text-indigo-400"
                                  >
                                     <Key className="w-4 h-4" />
                                     <span className="text-xs font-bold">إعادة تعيين كلمة المرور</span>
                                  </button>
                               )}
                            </div>
                         </div>
                      </div>
                   </div>
                </section>

                <section className="bg-white border border-slate-50 p-5 md:p-8 rounded-[28px] md:rounded-[40px] shadow-lg shadow-slate-100/50 space-y-6">
                   <header className="flex items-center justify-between border-b border-slate-50 pb-6 md:pb-8">
                      <div className="flex items-center gap-5">
                         <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-32 bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner shrink-0">
                            <Users className="w-6 h-6 md:w-8 md:h-8" />
                         </div>
                         <div>
                            <h2 className="text-lg md:text-2xl font-black text-slate-900 mb-1">سجل الأبناء والمنهج</h2>
                            <p className="text-[9px] md:text-[11px] font-black text-slate-300 uppercase tracking-widest leading-none">إجمالي التابعين: {children.length} طلاب</p>
                         </div>
                      </div>
                   </header>

                   {children.length === 0 ? (
                     <div className="p-24 text-center bg-slate-50 rounded-[56px] border border-dashed border-slate-200">
                        <Users className="w-20 h-20 text-slate-200 mx-auto mb-8" />
                        <p className="text-lg font-black text-slate-400">لا يوجد أبناء مرتبطون بهذا الحساب</p>
                        <p className="text-xs text-slate-300 font-medium mt-3">يمكنك ربط الطلاب بهذا الحساب من صفحة إدارة الطلاب.</p>
                     </div>
                   ) : (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {children.map((c: any) => (
                          <div 
                            key={c.id} 
                            onClick={() => navigate(`/students/${c.id}`)}
                            className="p-8 rounded-[40px] bg-slate-50/50 border border-slate-100 hover:bg-white hover:border-indigo-100 hover:shadow-3xl hover:translate-y-[-6px] transition-all duration-700 group cursor-pointer flex flex-col gap-8 h-full"
                          >
                             <div className="flex items-start justify-between">
                                <div className="flex items-center gap-5">
                                   <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-indigo-600 shadow-sm border border-slate-50 group-hover:bg-slate-900 group-hover:text-white transition-all duration-500">
                                      <User className="w-7 h-7" />
                                   </div>
                                   <div className="space-y-1">
                                      <h3 className="text-xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors leading-none mb-1">{c.name}</h3>
                                      <Badge className="bg-indigo-600/10 text-indigo-600 border-none font-bold text-[9px] px-3 py-1">{c.class_name || 'بدون فصل'}</Badge>
                                   </div>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-100 group-hover:text-indigo-600 transition-all opacity-0 group-hover:opacity-100 border border-slate-100">
                                   <ChevronLeft className="w-6 h-6" />
                                </div>
                             </div>

                             {c.curriculum && (
                                <div className="p-6 rounded-3xl bg-white border border-slate-100/50 space-y-4">
                                   <div className="flex items-center gap-3">
                                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">المنهج: {c.curriculum.name}</p>
                                   </div>
                                   <div className="flex flex-wrap gap-2">
                                      {c.curriculum.subjects.slice(0, 3).map((sub: any, idx: number) => (
                                         <span key={idx} className="text-[10px] font-bold text-slate-600 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100">{sub.subject_name}</span>
                                      ))}
                                      {c.curriculum.subjects.length > 3 && (
                                         <span className="text-[10px] font-bold text-indigo-400 px-3 py-1.5">+{c.curriculum.subjects.length - 3} مواد أخرى</span>
                                      )}
                                   </div>
                                </div>
                             )}
                          </div>
                        ))}
                     </div>
                   )}
                </section>
            </div>

            {/* Sidebar Governance */}
            <div className="lg:col-span-4 space-y-6">
               {/* Activity & Notifications Section */}
               <section className="bg-white rounded-[28px] md:rounded-[40px] p-5 md:p-8 space-y-6 shadow-lg border border-slate-100">
                  <div className="flex items-center gap-5">
                     <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner shrink-0">
                        <Clock className="w-7 h-7" />
                     </div>
                     <h2 className="text-xl font-black text-slate-900 leading-none">نشاط الحساب</h2>
                  </div>

                  {/* Last Seen */}
                  <div className="p-8 rounded-[48px] bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
                     <div className="flex items-center gap-4 mb-4">
                        <Clock className="w-5 h-5 text-blue-600" />
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">آخر ظهور</p>
                     </div>
                     <p className="text-lg font-black text-slate-900">
                       {parentLastSeen 
                         ? new Date(parentLastSeen).toLocaleString('ar-EG', { 
                             year: 'numeric', 
                             month: 'long', 
                             day: 'numeric',
                             hour: '2-digit',
                             minute: '2-digit'
                           })
                         : 'غير مسجل'
                       }
                     </p>
                  </div>

                  {/* Notification Stats */}
                  {notificationStats && (
                    <div className="space-y-6">
                       <div className="flex items-center gap-5">
                          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner shrink-0">
                             <Bell className="w-7 h-7" />
                          </div>
                          <h2 className="text-xl font-black text-slate-900 leading-none">إحصائيات الإشعارات</h2>
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                          {/* Total Sent */}
                          <div className="p-6 rounded-[32px] bg-amber-50 border border-amber-100">
                             <div className="flex items-center gap-3 mb-3">
                                <Send className="w-5 h-5 text-amber-600" />
                                <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">تم الإرسال</p>
                             </div>
                             <p className="text-3xl font-black text-slate-900">
                               {notificationStats.total_sent || 0}
                             </p>
                          </div>

                          {/* Total Read */}
                          <div className="p-6 rounded-[32px] bg-emerald-50 border border-emerald-100">
                             <div className="flex items-center gap-3 mb-3">
                                <CheckCircle className="w-5 h-5 text-emerald-600" />
                                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">تم القراءة</p>
                             </div>
                             <p className="text-3xl font-black text-slate-900">
                               {notificationStats.total_read || 0}
                             </p>
                          </div>
                       </div>

                       {/* Read Rate */}
                       {notificationStats.total_sent > 0 && (
                         <div className="p-6 rounded-[32px] bg-slate-50 border border-slate-100">
                            <div className="flex items-center justify-between mb-4">
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">نسبة القراءة</p>
                               <p className="text-lg font-black text-slate-900">
                                 {Math.round((notificationStats.total_read / notificationStats.total_sent) * 100)}%
                               </p>
                            </div>
                            <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden">
                               <div 
                                 className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                                 style={{ width: `${(notificationStats.total_read / notificationStats.total_sent) * 100}%` }}
                               />
                            </div>
                         </div>
                       )}

                       {/* Last Notification */}
                       {notificationStats.last_notification_at && (
                         <div className="p-6 rounded-[32px] bg-indigo-50 border border-indigo-100">
                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2">آخر إشعار</p>
                            <p className="text-sm font-bold text-slate-900">
                              {new Date(notificationStats.last_notification_at).toLocaleString('ar-EG', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                         </div>
                       )}
                    </div>
                  )}
               </section>

               <section className="bg-slate-900 rounded-[28px] md:rounded-[40px] p-5 md:p-8 space-y-6 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none opacity-20" />
                  
                  <div className="flex items-center gap-5 relative z-10">
                     <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-white shrink-0 shadow-inner">
                        <Shield className="w-7 h-7" />
                     </div>
                     <h2 className="text-xl font-black text-white leading-none">حوكمة الحساب</h2>
                  </div>

                  <div className="space-y-8 relative z-10">
                     <div className="p-8 rounded-[48px] bg-white/5 border border-white/5 flex items-center justify-between group/card hover:bg-white/10 transition-colors cursor-pointer">
                        <div className="flex items-center gap-5">
                            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-400">
                               <CreditCard className="w-6 h-6" />
                            </div>
                            <div className="space-y-1">
                               <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">الوضع المالي</p>
                               <p className="text-sm font-black text-white">منتظم السداد</p>
                            </div>
                        </div>
                        <ChevronLeft className="w-5 h-5 text-white/10 group-hover/card:text-emerald-400 transition-all" />
                     </div>

                     <div className="p-8 rounded-[48px] bg-white/5 border border-white/5 flex items-center justify-between group/card hover:bg-white/10 transition-colors cursor-pointer">
                        <div className="flex items-center gap-5">
                            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-indigo-400">
                               <MapPin className="w-6 h-6" />
                            </div>
                            <div className="space-y-1">
                               <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">العنوان السكني</p>
                               <p className="text-sm font-black text-white">غير محدد</p>
                            </div>
                        </div>
                        <ChevronLeft className="w-5 h-5 text-white/10 group-hover/card:text-indigo-400 transition-all" />
                     </div>
                  </div>

                  <div className="pt-8 border-t border-white/5 relative z-10 space-y-4">
                     <Button className="w-full h-14 md:h-16 rounded-[24px] md:rounded-[28px] bg-indigo-600 text-white font-black hover:bg-slate-100 hover:text-slate-900 transition-all text-xs shadow-3xl shadow-indigo-900/60">تحميل ملف الأسرة (Dossier)</Button>
                     <Button 
                       variant="ghost" 
                       onClick={handleDelete}
                       disabled={deleteParentMutation.isPending}
                       className="w-full h-14 md:h-16 rounded-[24px] md:rounded-[28px] text-rose-400 font-bold hover:bg-rose-500/10 text-xs gap-3"
                     >
                       {deleteParentMutation.isPending ? 'جاري الحذف...' : 'حذف حساب ولي الأمر نهائياً'}
                     </Button>
                  </div>
               </section>

               <div className="p-6 md:p-8 rounded-[28px] md:rounded-[40px] bg-emerald-600 text-white flex flex-col items-center gap-6 text-center shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />
                  <div className="w-24 h-24 bg-white/20 rounded-[40px] flex items-center justify-center relative z-10 transition-transform duration-700 group-hover:scale-110">
                      <Users className="w-12 h-12" />
                  </div>
                  <div className="space-y-3 relative z-10">
                     <h3 className="text-xl font-black">الربط العائلي</h3>
                     <p className="text-[11px] font-bold text-white/70 leading-relaxed italic px-4 uppercase tracking-[0.1em]">
                        يمكن لولي الأمر هذا مراقبة تقدم {children.length} طلاب مسجلين في مستويات تعليمية مختلفة من منصة موحدة.
                     </p>
                  </div>
               </div>
            </div>
          </div>
        </QueryStateHandler>
      </div>
    </AppLayout>
  );
}

function ContactCard({ icon: Icon, label, value, actionText, color }: any) {
  const colors: any = {
    indigo: "bg-indigo-600 text-white shadow-3xl shadow-indigo-100",
    slate: "bg-slate-900 text-white shadow-3xl shadow-slate-200",
  };
  return (
    <div className={cn("p-8 rounded-[48px] flex flex-col justify-between h-64 border transition-all duration-500 hover:scale-[1.04]", colors[color])}>
       <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center shadow-inner">
          <Icon className="w-7 h-7" />
       </div>
       <div className="space-y-4">
          <div>
             <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2 text-white/40">{label}</p>
             <p className="text-xl font-black tracking-tight leading-none truncate">{value}</p>
          </div>
          <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-300 hover:text-white transition-colors group">
             {actionText}
             <ChevronLeft className="w-4 h-4 group-hover:translate-x-[-4px] transition-transform" />
          </button>
       </div>
    </div>
  );
}
