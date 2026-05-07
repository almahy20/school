import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowRight, User, Users, School, Info, Mail, Shield, 
  Edit2, Trash2, Activity, Phone, MapPin, CheckCircle, 
  BookOpen, ChevronLeft, Loader2, Key, Eye, EyeOff
} from 'lucide-react';
import { EditTeacherModal } from './TeachersPage';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { logger } from '@/utils/logger';
import { Progress } from '@/components/ui/progress';
import { 
  useTeacher, 
  useTeacherClasses, 
  useTeacherDetailStats, 
  useDeleteTeacher 
} from '@/hooks/queries';
import { QueryStateHandler } from '@/components/QueryStateHandler';

export default function TeacherDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  
  const [showEdit, setShowEdit] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  // ── Queries ──
  const { data: teacher, isLoading: teacherLoading, error: teacherError, refetch: refetchTeacher } = useTeacher(id);
  const { data: classes = [], isLoading: classesLoading } = useTeacherClasses(id);
  const { data: stats = { studentCount: 0, curriculumProgress: 0 }, isLoading: statsLoading } = useTeacherDetailStats(id);


  // ── Mutations ──
  const deleteTeacherMutation = useDeleteTeacher();

  const handleDelete = async () => {
    if (!id || !confirm('هل أنت متأكد من حذف هذا المعلم نهائياً من قاعدة البيانات؟')) return;
    try {
      await deleteTeacherMutation.mutateAsync(id);
      toast({ title: 'تم الحذف بنجاح' });
      navigate('/teachers');
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
      
      logger.warn("Blocked insecure client-side admin auth call (403 Forbidden). Requires Edge Function or RPC.");
      
      setNewPassword('');
      setShowPassword(false);
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message || 'فشل في إعادة تعيين كلمة المرور', variant: 'destructive' });
    } finally {
      setResettingPassword(false);
    }
  };

  const isLoadingTotal = teacherLoading || classesLoading || statsLoading;

  return (
    <AppLayout>
      <div className="page-wrapper-detail">
        
        <QueryStateHandler
          loading={teacherLoading}
          error={teacherError}
          data={teacher}
          onRetry={refetchTeacher}
          loadingMessage="جاري استرجاع ملف المعلم وتاريخه المهني..."
        >
          {/* Ultra-Premium Hero Banner */}
          <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-gradient-to-l from-slate-900 via-emerald-950 to-slate-900 border-[0.5px] border-white/10 shadow-2xl p-8 md:p-12 rounded-[48px] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-emerald-500/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none mix-blend-screen" />
            <div className="absolute bottom-0 left-0 w-[25rem] h-[25rem] bg-indigo-500/10 rounded-full blur-[80px] translate-y-1/3 -translate-x-1/3 pointer-events-none mix-blend-screen" />
            
            <div className="flex items-center gap-6 md:gap-8 relative z-10 text-right w-full lg:w-2/3">
              <button 
                onClick={() => navigate('/teachers')}
                className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-xl shrink-0 backdrop-blur-md"
              >
                 <ArrowRight className="w-5 h-5 md:w-7 md:h-7" />
              </button>
              
              <div className="flex items-center gap-5 md:gap-8 min-w-0">
                 <Avatar className="w-16 h-16 md:w-24 md:h-24 rounded-[28px] md:rounded-[40px] border-[3px] border-white/20 shadow-2xl shadow-emerald-900/30 shrink-0 group-hover:rotate-3 transition-transform duration-700">
                    <AvatarFallback className="bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white text-2xl md:text-4xl font-black rounded-none">
                       {teacher?.full_name?.[0]}
                    </AvatarFallback>
                 </Avatar>
                 <div className="space-y-2 min-w-0">
                    <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter drop-shadow-sm mb-1 truncate">{teacher?.full_name}</h1>
                    <div className="flex items-center gap-3 flex-wrap">
                       <Badge className="bg-white/10 text-white border border-white/10 font-bold text-[10px] md:text-xs uppercase tracking-widest px-4 py-1.5 md:px-5 md:py-2 rounded-2xl backdrop-blur-md shadow-sm">
                          {teacher?.specialization || 'التخصص التعليمي'}
                       </Badge>
                       <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-[10px] md:text-xs uppercase tracking-widest px-4 py-1.5 md:px-5 md:py-2 rounded-2xl backdrop-blur-md">
                          عضو منذ {teacher?.created_at ? new Date(teacher.created_at).getFullYear() : '—'}
                       </Badge>
                    </div>
                 </div>
              </div>
            </div>
            
            {authUser?.role === 'admin' && (
              <div className="flex items-center gap-4 relative z-10 w-full lg:w-auto lg:justify-end mt-4 lg:mt-0">
                <Button 
                  onClick={() => setShowEdit(true)}
                  className="h-14 md:h-16 px-8 rounded-2xl md:rounded-[24px] bg-white text-slate-900 font-black text-xs md:text-sm hover:bg-slate-50 transition-all shadow-xl gap-3 flex-1 lg:flex-none"
                >
                  <Edit2 className="w-4 h-4 md:w-5 md:h-5 text-emerald-600" /> تعديل السجل
                </Button>
                <Button 
                  onClick={handleDelete}
                  disabled={deleteTeacherMutation.isPending}
                  className="h-14 md:h-16 w-14 md:w-16 rounded-2xl md:rounded-[24px] bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-all shadow-lg flex items-center justify-center shrink-0 backdrop-blur-md"
                >
                  {deleteTeacherMutation.isPending ? <Loader2 className="w-6 h-6 md:w-7 md:h-7 animate-spin" /> : <Trash2 className="w-6 h-6 md:w-7 md:h-7" />}
                </Button>
              </div>
            )}
          </header>

          {/* Teacher Metrics Grid - Remove curriculum progress and status cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <StatsCard title="النصاب التعليمي" value={classes.length} sub="فصول مسندة" icon={School} color="indigo" />
             <StatsCard title="إجمالي الطلاب" value={stats.studentCount} sub="شخص تحت الإشراف" icon={Users} color="emerald" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-8 space-y-12">
                <section className="bg-white border border-slate-50 p-12 rounded-[56px] shadow-xl shadow-slate-100/50 space-y-10">
                   <header className="flex items-center gap-4 border-b border-slate-50 pb-8">
                      <div className="w-14 h-14 rounded-32 bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner shrink-0">
                         <School className="w-7 h-7" />
                      </div>
                      <div>
                         <h2 className="text-2xl font-black text-slate-900 mb-1">الفصول والمسؤوليات</h2>
                         <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none">إدارة الجداول والحصص الدراسية</p>
                      </div>
                   </header>

                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {classes.length === 0 ? (
                        <div className="col-span-2 p-20 text-center bg-slate-50 rounded-[48px] border border-dashed border-slate-100">
                           <div className="w-16 h-16 rounded-3xl bg-white flex items-center justify-center mx-auto mb-6 text-slate-200">
                             <School className="w-8 h-8" />
                           </div>
                           <p className="text-sm font-black text-slate-400">لا توجد فصول دراسية مرتبطة بهذا المعلم حالياً.</p>
                        </div>
                      ) : classes.map(c => (
                        <div 
                          key={c.id} 
                          onClick={() => navigate(`/classes/${c.id}`)} 
                          className="p-8 rounded-[32px] bg-slate-50/50 border border-slate-100 hover:bg-white hover:border-indigo-100 hover:shadow-2xl hover:shadow-slate-200/50 hover:translate-y-[-4px] transition-all duration-500 group flex items-center justify-between cursor-pointer"
                        >
                           <div className="flex items-center gap-5">
                              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-indigo-600 shadow-sm group-hover:bg-slate-900 group-hover:text-white transition-all duration-500">
                                 <CheckCircle className="w-6 h-6 border-none" />
                              </div>
                              <div className="space-y-1">
                                 <span className="text-base font-black text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors">{c.name}</span>
                                 <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">مرحلة {c.grade_level || 'غير محددة'}</p>
                              </div>
                           </div>
                           <ChevronLeft className="w-5 h-5 text-slate-200 group-hover:text-indigo-600 transition-all translate-x-2 group-hover:translate-x-0" />
                        </div>
                      ))}
                   </div>
                </section>

                {/* Removed: Professional Performance Indicators section */}
            </div>

            {/* Sidebar Context */}
            <div className="lg:col-span-4 space-y-12">
               <section className="bg-slate-900 rounded-[56px] p-12 space-y-10 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none opacity-20" />
                  <div className="flex items-center gap-4 relative z-10">
                     <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white shrink-0 shadow-inner">
                        <Shield className="w-6 h-6 border-none" />
                     </div>
                     <h2 className="text-xl font-black text-white leading-none">بيانات الاتصال</h2>
                  </div>

                  <div className="space-y-6 relative z-10">
                     <ContactItem icon={Phone} label="رقم الجوال الخاص" value={teacher?.phone || 'غير مسجل'} />
                     
                     {/* Password Card */}
                     <div className="space-y-3">
                        <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] flex items-center gap-2">
                           <Key className="w-3.5 h-3.5" />
                           كلمة المرور
                        </label>
                        
                        {showPassword ? (
                           <div className="space-y-3 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
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
                                    <EyeOff className="w-4 h-4 text-white/50" />
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
                             className="w-full h-12 rounded-xl border-2 border-dashed border-white/10 hover:border-indigo-500/50 hover:bg-white/5 flex items-center justify-center gap-2 transition-all text-white/30 hover:text-indigo-400"
                           >
                              <Key className="w-4 h-4" />
                              <span className="text-xs font-bold">إعادة تعيين كلمة المرور</span>
                           </button>
                        )}
                     </div>
                     
                     <ContactItem icon={MapPin} label="موقع العمل" value="الجناح الأكاديمي - قسم المعلمين" />
                  </div>

                  {/* Removed: Download PDF button */}
               </section>

               <div className="p-10 rounded-[48px] bg-slate-50 border border-slate-100 text-center relative overflow-hidden group">
                  <div className="relative z-10 space-y-6">
                     <div className="w-20 h-20 bg-white rounded-[32px] shadow-xl shadow-slate-200/50 flex items-center justify-center mx-auto text-slate-200 transition-transform duration-700 group-hover:scale-110">
                         <User className="w-10 h-10 border-none" />
                     </div>
                     <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">ملخص الإشراف</p>
                        <p className="text-xs font-bold text-slate-600 leading-relaxed">
                           المعلم {teacher?.full_name?.split(' ')[1] || ''} يشرف حالياً على {stats.studentCount} طالباً عبر {classes.length} فصول بمستويات دراسية مختلفة.
                        </p>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </QueryStateHandler>
      </div>

      {showEdit && teacher && (
        <EditTeacherModal 
          teacher={{ ...teacher, classes }}
          onClose={() => { setShowEdit(false); refetchTeacher(); }} 
        />
      )}
    </AppLayout>
  );
}

function StatsCard({ title, value, sub, icon: Icon, color, smallValue }: any) {
  const configs: any = {
    indigo: "bg-slate-900 text-white border-slate-900 shadow-2xl shadow-slate-200",
    emerald: "bg-white text-slate-900 border-slate-50 shadow-xl shadow-slate-100",
    amber: "bg-amber-500 text-white border-amber-500 shadow-2xl shadow-amber-100",
    slate: "bg-indigo-600 text-white border-indigo-600 shadow-xl shadow-indigo-100",
  };
  
  const iconConfigs: any = {
    indigo: "bg-white/10 text-white",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-white/20 text-white",
    slate: "bg-white/10 text-white",
  };

  return (
    <div className={cn("premium-card p-8 md:p-10 flex flex-col justify-between border-[0.5px] h-52 md:h-60 rounded-[40px] md:rounded-[48px] transition-all hover:scale-[1.03] duration-500", configs[color])}>
       <div className={cn("w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center shadow-sm", iconConfigs[color])}>
          <Icon className="w-6 h-6 md:w-7 md:h-7" />
       </div>
       <div className="mt-6 md:mt-8 text-right">
          <p className={cn("text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] mb-1 md:mb-2 opacity-60", color === 'emerald' ? "text-slate-400" : "text-white/40")}>{title}</p>
          <div className="flex flex-col">
             <h3 className={cn("font-black tracking-tighter leading-none mb-1 md:mb-2", smallValue ? "text-xl md:text-2xl" : "text-3xl md:text-5xl")}>{value}</h3>
             <span className={cn("text-[9px] md:text-[11px] font-bold opacity-60", color === 'emerald' ? "text-slate-400" : "text-white/40")}>{sub}</span>
          </div>
       </div>
    </div>
  );
}

function LoadProgress({ label, percentage, color }: { label: string; percentage: number; color: string }) {
  const colors: any = {
    indigo: "bg-indigo-600 shadow-indigo-100",
    emerald: "bg-emerald-500 shadow-emerald-100",
    amber: "bg-amber-500 shadow-amber-100"
  };
  return (
    <div className="space-y-4">
       <div className="flex justify-between items-end px-1">
          <span className="text-sm font-black text-slate-800">{label}</span>
          <div className="flex items-center gap-2">
             <div className={cn("w-2 h-2 rounded-full", colors[color])} />
             <span className="text-[12px] font-black text-slate-900 tracking-tight">{percentage}%</span>
          </div>
       </div>
       <div className="h-2.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
          <div className={cn("h-full transition-all duration-1000 rounded-full shadow-lg", colors[color])} style={{ width: `${percentage}%` }} />
       </div>
    </div>
  );
}

function ContactItem({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center gap-5 group cursor-pointer hover:translate-x-[-4px] transition-transform">
       <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-white/30 group-hover:bg-white/10 group-hover:text-white transition-all shrink-0">
          <Icon className="w-5 h-5 border-none" />
       </div>
       <div className="min-w-0 text-right">
          <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">{label}</p>
          <p className="text-sm font-black text-white/80 truncate leading-none">{value}</p>
       </div>
    </div>
  );
}
