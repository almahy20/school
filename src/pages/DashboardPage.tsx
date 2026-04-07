import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, GraduationCap, UserCheck, School, BookOpen, 
  TrendingUp, Award, ArrowUpRight, Zap, Target,
  CheckCircle, XCircle, Clock, AlertCircle, Eye, X,
  ClipboardList, CalendarCheck, Calendar, MessageSquare,
  ChevronRight, Activity, Link2, Copy, LayoutGrid, Bell, Filter, Wallet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

import { useNavigate } from 'react-router-dom';

import ParentDashboard from './ParentDashboard';
import { 
  useParentChildOverview, 
  useParentChildActivities,
  useAdminStats,
  useTeacherStats,
  useAdminActivities,
  useClasses,
  useBranding
} from '@/hooks/queries';


export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.isSuperAdmin) {
      navigate('/super-admin', { replace: true });
    }
  }, [user, navigate]);

  return (
    <AppLayout>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
        {user?.role === 'parent' ? <ParentDashboard />
          : user?.role === 'teacher' ? <TeacherDashboard />
          : user?.role === 'admin' ? <AdminDashboard />
          : <div className="min-h-[400px] flex items-center justify-center p-6"><div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" /></div>}
      </div>
    </AppLayout>
  );
}

// ─── Shared Components ────────────────────────────────────────────────────────
function StatsCard({ title, value, icon: Icon, color, trend, subValue }: any) {
  const colors: any = {
    primary: "bg-slate-900 text-white border-slate-800 shadow-slate-200/50",
    emerald: "bg-emerald-500 text-white border-emerald-400/20 shadow-emerald-100",
    amber: "bg-amber-500 text-white border-amber-400/20 shadow-emerald-100",
    indigo: "bg-indigo-600 text-white border-indigo-500/20 shadow-indigo-100",
    white: "bg-white text-slate-900 border-slate-100 shadow-slate-200/20",
    rose: "bg-rose-500 text-white border-rose-400/20 shadow-rose-100",
    blue: "bg-blue-600 text-white border-blue-500/20 shadow-blue-100"
  };

  return (
    <div className={cn(
      "group premium-card flex flex-col justify-between border shadow-sm hover:shadow-md transition-all duration-300 p-5 md:p-6",
      colors[color || 'white']
    )}>
      <div className="flex items-start justify-between">
        <div className={cn(
          "w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-transform group-hover:rotate-3",
          color === 'white' ? 'bg-slate-50 text-slate-400' : 'bg-white/20 text-white'
        )}>
          <Icon className="w-4 h-4 md:w-5 md:h-5" />
        </div>
        {trend && (
          <div className={cn(
            "px-2 py-0.5 rounded-full text-[8px] md:text-[10px] font-bold flex items-center gap-1",
            color === 'white' ? 'bg-emerald-50 text-emerald-600' : 'bg-white/20 text-white'
          )}>
            {trend}
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className={cn("text-[9px] md:text-[10px] font-bold uppercase tracking-wide mb-1 opacity-70")}>{title}</p>
        <h3 className="text-xl md:text-2xl font-bold leading-none tracking-tight">{value}</h3>
        {subValue && <p className="text-[8px] md:text-[10px] mt-1.5 opacity-80 font-medium">{subValue}</p>}
      </div>
    </div>
  );
}

// ─── Shared Components ────────────────────────────────────────────────────────

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
function AdminDashboard() {
  const { user } = useAuth();
  const { data: stats = { students: 0, teachers: 0, parents: 0, classes: 0, totalDue: 0, totalPaid: 0, attendanceRate: 0, presentToday: 0 } } = useAdminStats();
  const { data: activities = [], isLoading: activitiesLoading } = useAdminActivities();

  const userName = user?.fullName ? user.fullName.split(' ')[0] : 'أدمن';

  return (
    <div className="flex flex-col gap-12 max-w-[1500px] mx-auto text-right">
      <header className="bg-slate-900 p-6 md:p-10 lg:p-12 rounded-[32px] md:rounded-[48px] text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.05] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-10">
          <div className="flex items-center gap-4 md:gap-6 text-right">
            <div className="w-14 h-14 md:w-20 md:h-20 rounded-[20px] md:rounded-[28px] bg-white flex items-center justify-center shadow-2xl rotate-3 group-hover:rotate-0 transition-all duration-500 shrink-0">
               <School className="w-7 h-7 md:w-10 md:h-10 text-slate-900" />
            </div>
            <div className="space-y-1 md:space-y-2">
               <h1 className="text-xl md:text-4xl font-black tracking-tight leading-tight">مرحباً، {userName}</h1>
               <p className="text-white/40 text-xs md:text-base font-medium leading-relaxed max-w-2xl">
                 نظرة عامة شاملة على أداء المدرسة اليوم. تابع التحصيل المالي، حضور الطلاب، ونشاط الكادر التعليمي.
               </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 md:gap-4 px-5 md:px-8 py-3.5 md:py-5 rounded-[20px] md:rounded-[32px] bg-white/5 border border-white/10 backdrop-blur-xl relative z-10 group hover:scale-105 transition-all w-full md:w-auto">
             <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-white/10 flex items-center justify-center text-white/40 group-hover:text-white transition-colors shrink-0">
               <Calendar className="w-5 h-5 md:w-7 md:h-7" />
             </div>
             <div className="min-w-0">
               <p className="text-[8px] md:text-[10px] font-black text-white/30 uppercase tracking-widest leading-none mb-1 md:mb-2 text-right">تاريخ اليوم</p>
               <p className="text-sm md:text-xl font-black text-white leading-none text-right truncate">{new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
             </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-8">
        <StatsCard title="إجمالي الطلاب" value={stats.students || 0} icon={Users} color="white" trend="نشط" />
        <StatsCard 
          title="التحصيل المالي" 
          value={`${(stats.totalPaid || 0).toLocaleString()} ج.م`} 
          subValue={`من إجمالي ${(stats.totalDue || 0).toLocaleString()} ج.م`} 
          icon={Wallet} 
          color="indigo" 
        />
        <StatsCard 
          title="نسبة الحضور اليوم" 
          value={`${stats.attendanceRate || 0}%`} 
          subValue={`حضور ${stats.presentToday || 0} طالب`} 
          icon={CalendarCheck} 
          color="emerald" 
        />
        <StatsCard title="كادر المعلمين" value={stats.teachers || 0} icon={GraduationCap} color="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 premium-card p-6 md:p-8">
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 md:mb-10">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center text-primary shadow-sm">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                   <h2 className="text-xl font-black text-slate-900">النشاطات الأخيرة</h2>
                   <p className="text-slate-400 text-[10px] font-medium mt-0.5">سجل التغييرات والعمليات المنفذة في النظام</p>
                </div>
             </div>
             <Button variant="ghost" className="h-10 px-4 rounded-xl text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 self-start sm:self-auto">عرض سجل العمليات</Button>
           </div>
           
           <div className="space-y-6">
              {activitiesLoading ? (
                <div className="space-y-4">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-20 bg-slate-50 animate-pulse rounded-3xl" />
                  ))}
                </div>
              ) : activities.length > 0 ? (
                activities.map((act: any) => {
                  const Icon = act.type === 'complaint' ? MessageSquare : act.type === 'registration' ? UserCheck : Wallet;
                  return (
                    <div key={act.id} className="group p-4 md:p-5 rounded-2xl border border-slate-100 bg-white hover:bg-slate-50 transition-all flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                         <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shrink-0">
                            <Icon className="w-5 h-5" />
                         </div>
                         <div className="min-w-0">
                            <h3 className="text-sm font-black text-slate-900 mb-0.5 truncate">{act.title}</h3>
                            <p className="text-[10px] font-medium text-slate-400 truncate">{act.description}</p>
                         </div>
                      </div>
                      <div className="text-left shrink-0">
                         <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">{new Date(act.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}</p>
                         <Badge variant="outline" className={cn(
                           "border-none font-bold text-[8px] py-0 px-2 rounded-lg h-5 flex items-center justify-center",
                           act.status === 'pending' ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                         )}>
                           {act.status === 'pending' ? 'قيد الانتظار' : 'مكتمل'}
                         </Badge>
                      </div>
                    </div>
                  );
                })
              ) : (
                 <div className="p-24 text-center flex flex-col items-center gap-6 bg-slate-50/50 border border-dashed border-slate-200 rounded-[48px] relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="w-20 h-20 rounded-[32px] bg-white flex items-center justify-center text-slate-200 shadow-inner border border-slate-100 relative z-10 group-hover:scale-110 transition-transform">
                       <Activity className="w-10 h-10" />
                    </div>
                    <div className="relative z-10 space-y-2">
                       <p className="text-slate-900 font-black text-lg">لا توجد نشاطات مؤخرة</p>
                       <p className="text-slate-400 font-medium text-sm">سيظهر هنا أي تحديثات تتم على بيانات الطلاب أو المعلمين.</p>
                    </div>
                 </div>
              )}
           </div>
        </div>

        <div className="flex flex-col gap-10">
           <RegistrationLinksCard />
           
           <div className="premium-card bg-slate-100/50 border-slate-200 flex flex-col items-center justify-center relative overflow-hidden flex-1 group">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />
                <div className="text-center p-12 space-y-6 relative z-10">
                   <div className="w-16 h-16 rounded-[24px] bg-white flex items-center justify-center text-slate-200 mx-auto shadow-inner border border-slate-100 group-hover:rotate-12 transition-transform">
                      <Target className="w-8 h-8" />
                   </div>
                   <div className="space-y-2">
                      <h3 className="text-xl font-black tracking-tight text-slate-400">الأهداف الاستراتيجية</h3>
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">قريباً في التحديث القادم</p>
                   </div>
                </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function RegistrationLinksCard() {
  const { toast } = useToast();
  const { data: branding } = useBranding();
  const slug = branding?.slug || '';

  const copy = (type: 'teachers' | 'parents') => {
    const link = `${window.location.origin}/register/${type}/${slug}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'تم النسخ', description: `تم نسخ رابط تسجيل ${type === 'teachers' ? 'المعلمين' : 'أولياء الأمور'}` });
  };

  return (
    <div className="premium-card border-indigo-100 bg-indigo-50/30 p-8 space-y-6">
       <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <LinkIcon className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-slate-900">روابط التسجيل</h2>
       </div>
       
       <div className="space-y-4">
          <div className="space-y-1.5">
             <label className="text-[10px] font-black text-indigo-600/50 uppercase tracking-widest mr-1">رابط المعلمين</label>
             <div className="flex gap-2">
                <div className="flex-1 h-12 px-4 rounded-xl bg-white border border-indigo-100 flex items-center text-xs font-bold text-slate-500 overflow-hidden whitespace-nowrap" dir="ltr">
                   .../register/teachers/{slug}
                </div>
                <Button onClick={() => copy('teachers')} className="w-12 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white p-0 shrink-0">
                   <CopyIcon className="w-5 h-5" />
                </Button>
             </div>
          </div>

          <div className="space-y-1.5">
             <label className="text-[10px] font-black text-indigo-600/50 uppercase tracking-widest mr-1">رابط أولياء الأمور</label>
             <div className="flex gap-2">
                <div className="flex-1 h-12 px-4 rounded-xl bg-white border border-indigo-100 flex items-center text-xs font-bold text-slate-500 overflow-hidden whitespace-nowrap" dir="ltr">
                   .../register/parents/{slug}
                </div>
                <Button onClick={() => copy('parents')} className="w-12 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white p-0 shrink-0">
                   <CopyIcon className="w-5 h-5" />
                </Button>
             </div>
          </div>
       </div>
       
       <p className="text-[10px] font-bold text-indigo-400 leading-relaxed">
          شارك هذه الروابط مع المعلمين وأولياء الأمور ليتمكنوا من الانضمام لمدرستك مباشرة.
       </p>
    </div>
  );
}

// Re-using common icons
const LinkIcon = ({ className }: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
);
const CopyIcon = ({ className }: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
);

// ─── Teacher Dashboard ────────────────────────────────────────────────────────
function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: myClasses = [] } = useClasses();
  const { data: stats = { classes: 0, students: 0 } } = useTeacherStats();

  return (
    <div className="flex flex-col gap-12 max-w-[1500px] mx-auto text-right">
      <header className="bg-slate-900 p-6 md:p-10 lg:p-12 rounded-[32px] md:rounded-[48px] text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.05] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-10">
          <div className="flex items-center gap-4 md:gap-6 text-right">
            <div className="w-14 h-14 md:w-20 md:h-20 rounded-[20px] md:rounded-[28px] bg-white flex items-center justify-center shadow-2xl rotate-3 group-hover:rotate-0 transition-all duration-500 shrink-0">
               <GraduationCap className="w-7 h-7 md:w-10 md:h-10 text-slate-900" />
            </div>
            <div className="space-y-1 md:space-y-2">
               <h1 className="text-xl md:text-4xl font-black tracking-tight leading-tight">مرحباً، أ. {user?.fullName?.split(' ')[0]}</h1>
               <p className="text-white/40 text-xs md:text-base font-medium leading-relaxed max-w-2xl">أهلاً بك في فضاء المعلم المبدع. تابع فصولك، قيم أداء طلابك، وقم بإدارة المحتوى الدراسي بكل سلاسة واحترافية.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 md:gap-4 px-5 md:px-8 py-3.5 md:py-5 rounded-[20px] md:rounded-[32px] bg-white/5 border border-white/10 backdrop-blur-xl relative z-10 group hover:scale-105 transition-all w-full md:w-auto">
             <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-white/10 flex items-center justify-center text-white/40 group-hover:text-white transition-colors shrink-0">
               <Calendar className="w-5 h-5 md:w-7 md:h-7" />
             </div>
             <div className="min-w-0">
               <p className="text-[8px] md:text-[10px] font-black text-white/30 uppercase tracking-widest leading-none mb-1 md:mb-2 text-right">تاريخ اليوم</p>
               <p className="text-sm md:text-xl font-black text-white leading-none text-right truncate">{new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
             </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <StatsCard title="فصولي الدراسية" value={stats.classes} icon={School} color="indigo" trend="نشط" />
        <StatsCard title="الطلاب النشطون" value={stats.students} icon={Users} color="emerald" />
      </div>

      <section className="premium-card p-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
           <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm">
                <LayoutGrid className="w-7 h-7" />
              </div>
              <div>
                 <h2 className="text-3xl font-black text-slate-900 tracking-tight">إدارة الفصول النشطة</h2>
                 <p className="text-slate-400 font-medium text-sm mt-1">عرض وتحديث سجلات الطلاب والمنهج لكل فصل</p>
              </div>
           </div>
           <Button variant="outline" className="h-14 px-8 rounded-2xl border-slate-200 font-black text-xs gap-3 hover:bg-slate-50 transition-all">
              <Filter className="w-4 h-4" /> تصفية الفصول
           </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
           {myClasses.length > 0 ? myClasses.map(c => (
             <div key={c.id} className="p-10 rounded-[40px] bg-slate-50/50 border border-slate-100 group hover:bg-white hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
               
               <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-slate-900 font-black border border-slate-100 shadow-sm group-hover:scale-110 transition-transform">
                     {c.name.trim()[0]}
                  </div>
                  <Badge className="bg-white border-slate-100 text-slate-400 font-black text-[9px] uppercase tracking-widest shadow-sm">
                    {c.grade_level || 'دراسات عليا'}
                  </Badge>
               </div>

               <h3 className="text-2xl font-black text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">{c.name}</h3>
               <p className="text-xs font-medium text-slate-400 leading-relaxed mb-8">
                  إدارة شاملة لطلاب الفصل، رصد الدرجات، ومتابعة التقدم في الخطة الدراسية.
               </p>

               <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                  <div className="flex -space-x-3 space-x-reverse">
                     {[1,2,3].map(i => (
                       <div key={i} className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-500">
                          {i}
                       </div>
                     ))}
                     <div className="w-8 h-8 rounded-full bg-slate-900 border-2 border-white flex items-center justify-center text-[8px] font-bold text-white">
                        +20
                     </div>
                  </div>
                  <Button 
                    onClick={() => navigate(`/classes/${c.id}`)}
                    className="rounded-2xl bg-white text-slate-900 border border-slate-200 hover:bg-slate-900 hover:text-white transition-all px-6 font-black text-xs h-11"
                  >
                     دخول السجل
                  </Button>
               </div>
             </div>
           )) : (
             <div className="col-span-full p-20 text-center flex flex-col items-center gap-6 bg-slate-50/50 border border-dashed border-slate-200 rounded-[40px] relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-16 h-16 rounded-[24px] bg-white flex items-center justify-center text-slate-200 shadow-inner border border-slate-100 relative z-10 group-hover:scale-110 transition-transform">
                   <School className="w-8 h-8" />
                </div>
                <div className="relative z-10 space-y-2">
                   <p className="text-slate-900 font-black text-lg">لا توجد فصول دراسية</p>
                   <p className="text-slate-400 font-medium text-sm">لم يتم تعيين أي فصول دراسية لك بعد. يرجى التواصل مع إدارة المدرسة.</p>
                </div>
             </div>
           )}
        </div>
      </section>
    </div>
  );
}


