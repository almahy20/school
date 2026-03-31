import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, GraduationCap, UserCheck, School, BookOpen, 
  TrendingUp, Award, ArrowUpRight, Zap, Target,
  CheckCircle, XCircle, Clock, AlertCircle, Eye, X,
  ClipboardList, CalendarCheck, Calendar, MessageSquare,
  ChevronRight, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export default function DashboardPage() {
  const { user } = useAuth();
  return (
    <AppLayout>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
        {user?.role === 'parent' ? <ParentDashboard />
          : user?.role === 'teacher' ? <TeacherDashboard />
          : <AdminDashboard />}
      </div>
    </AppLayout>
  );
}

// ─── Shared Components ────────────────────────────────────────────────────────
function StatsCard({ title, value, icon: Icon, color, trend }: any) {
  const colors: any = {
    primary: "bg-slate-900 text-white border-slate-800 shadow-slate-200/50",
    emerald: "bg-emerald-500 text-white border-emerald-400/20 shadow-emerald-100",
    amber: "bg-amber-500 text-white border-amber-400/20 shadow-amber-100",
    indigo: "bg-indigo-600 text-white border-indigo-500/20 shadow-indigo-100",
    white: "bg-white text-slate-900 border-slate-100 shadow-slate-200/20"
  };

  return (
    <div className={cn(
      "group premium-card p-8 flex flex-col justify-between border shadow-xl hover:scale-[1.02] transition-all duration-500",
      colors[color || 'white']
    )}>
      <div className="flex items-start justify-between">
        <div className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-6",
          color === 'white' ? 'bg-slate-50 text-slate-400' : 'bg-white/20 text-white'
        )}>
          <Icon className="w-7 h-7" />
        </div>
        {trend && (
          <div className={cn(
            "px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-1",
            color === 'white' ? 'bg-emerald-50 text-emerald-600' : 'bg-white/20 text-white'
          )}>
            <ArrowUpRight className="w-3 h-3" />
            {trend}
          </div>
        )}
      </div>
      <div className="mt-8">
        <p className={cn("text-[11px] font-black uppercase tracking-widest mb-1 opacity-60")}>{title}</p>
        <h3 className="text-4xl font-black leading-none tracking-tighter">{value}</h3>
      </div>
    </div>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ students: 0, teachers: 0, parents: 0, classes: 0 });

  useEffect(() => {
    if (!user?.schoolId) return;
    Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', user.schoolId),
      supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'teacher').eq('school_id', user.schoolId),
      supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'parent').eq('school_id', user.schoolId),
      supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', user.schoolId),
    ]).then(([s, t, p, c]) => {
      setStats({ students: s.count || 0, teachers: t.count || 0, parents: p.count || 0, classes: c.count || 0 });
    });
  }, [user?.schoolId]);

  return (
    <div className="flex flex-col gap-12 max-w-[1500px] mx-auto text-right">
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 bg-white/40 backdrop-blur-md p-10 rounded-[48px] border border-white/50 shadow-xl shadow-slate-200/10">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-2 h-10 bg-primary rounded-full" />
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">نظرة عامة على المؤسسة</h1>
          </div>
          <p className="text-slate-500 font-medium text-lg pr-5">إدارة البيانات المركزية والكادر التعليمي</p>
        </div>
        
        <div className="flex items-center gap-4 px-8 py-4 rounded-[32px] bg-white border border-slate-100 shadow-sm">
           <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
             <Calendar className="w-6 h-6" />
           </div>
           <div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">تاريخ اليوم</p>
             <p className="text-lg font-black text-slate-700 leading-none">{new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
           </div>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-8">
        <StatsCard title="إجمالي الطلاب" value={stats.students} icon={Users} color="primary" trend="نشط جداً" />
        <StatsCard title="كادر المعلمين" value={stats.teachers} icon={GraduationCap} color="indigo" />
        <StatsCard title="أولياء الأمور" value={stats.parents} icon={UserCheck} color="amber" />
        <StatsCard title="الفصول الدراسية" value={stats.classes} icon={School} color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 premium-card">
           <div className="flex items-center justify-between mb-10">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
                  <Activity className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-black text-slate-900">النشاطات الأخيرة</h2>
             </div>
             <Button variant="ghost" className="text-slate-400 font-black text-xs uppercase tracking-widest">عرض الكل</Button>
           </div>
           
           <div className="space-y-6">
              <div className="p-20 text-center flex flex-col items-center gap-4 bg-slate-50 border border-dashed border-slate-200 rounded-[32px]">
                 <Activity className="w-10 h-10 text-slate-200" />
                 <p className="text-slate-400 font-medium text-sm text-center">لا توجد نشاطات مؤخرة لعرضها حالياً</p>
              </div>
           </div>
        </div>

        <div className="premium-card bg-slate-100 text-slate-400 border-slate-200 flex items-center justify-center relative overflow-hidden">
             <div className="text-center p-10 space-y-4">
                <Target className="w-12 h-12 mx-auto opacity-20" />
                <h3 className="text-xl font-black tracking-tight text-slate-400">لا توجد أهداف محددة</h3>
             </div>
        </div>
      </div>
    </div>
  );
}

// ─── Teacher Dashboard ────────────────────────────────────────────────────────
function TeacherDashboard() {
  const { user } = useAuth();
  const [myClasses, setMyClasses] = useState<any[]>([]);
  const [studentCount, setStudentCount] = useState(0);

  useEffect(() => {
    if (!user?.schoolId) return;
    supabase.from('classes')
      .select('*')
      .eq('school_id', user.schoolId)
      .eq('teacher_id', user.id)
      .then(async ({ data }) => {
        setMyClasses(data || []);
        if (data?.length) {
          const classIds = data.map(c => c.id);
          const { count } = await supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .eq('school_id', user.schoolId)
            .in('class_id', classIds);
          setStudentCount(count || 0);
        }
      });
  }, [user?.id, user?.schoolId]);

  return (
    <div className="flex flex-col gap-12 max-w-[1500px] mx-auto text-right">
      <header className="bg-slate-900 p-12 sm:p-20 rounded-[64px] text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.05),transparent)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-12">
          <div className="flex items-center gap-8">
            <div className="w-24 h-24 rounded-[32px] bg-white flex items-center justify-center shadow-2xl rotate-3 group-hover:rotate-0 transition-transform duration-500">
               <Award className="w-12 h-12 text-slate-900" />
            </div>
            <div className="space-y-3">
               <h1 className="text-4xl sm:text-5xl font-black tracking-tight">أهلاً بك، {user?.fullName?.split(' ')[0]}</h1>
               <p className="text-white/40 text-xl font-medium leading-relaxed max-w-2xl">
                 رسالتك السامية تبني أجيال الغد. يمكنك إدارة فصولك ومتابعة طلابك بكل سهولة.
               </p>
            </div>
          </div>
          <div className="flex items-center gap-4 px-10 py-6 rounded-[32px] bg-white/5 border border-white/10 backdrop-blur-xl">
             <div className="text-right">
               <p className="text-[11px] font-black text-white/30 uppercase tracking-widest mb-1">الطلاب تحت إشرافك</p>
               <p className="text-4xl font-black">{studentCount}</p>
             </div>
             <Users className="w-10 h-10 text-white/20" />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <StatsCard title="فصولي الدراسية" value={myClasses.length} icon={School} color="indigo" />
        <StatsCard title="تقييمات اليوم" value="0" icon={CalendarCheck} color="emerald" />
        <StatsCard title="الشكاوى النشطة" value="0" icon={AlertCircle} color="amber" />
      </div>

      <div className="premium-card p-12">
        <div className="flex items-center justify-between mb-10">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <ClipboardList className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-black text-slate-900">فصولي النشطة</h2>
           </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
           {myClasses.map(c => (
             <div key={c.id} className="p-8 rounded-[32px] bg-slate-50 border border-slate-100 group hover:bg-white hover:shadow-2xl hover:shadow-slate-200/40 transition-all duration-500">
               <h3 className="text-xl font-black text-slate-900 mb-2">{c.name}</h3>
               <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{c.grade_level || 'دراسات أكاديمية'}</p>
               <div className="mt-8 flex justify-end">
                 <Button className="rounded-[18px] bg-white text-slate-900 border border-slate-200 hover:bg-slate-900 hover:text-white transition-all px-4 font-black text-xs">عرض الفصل</Button>
               </div>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
}

// ─── Parent Dashboard ─────────────────────────────────────────────────────────
function ParentDashboard() {
  const { user } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.schoolId) return;
    (async () => {
      setLoading(true);
      const { data: links } = await (supabase as any)
        .from('student_parents')
        .select('student_id')
        .eq('school_id', user.schoolId)
        .eq('parent_id', user.id);

      if (!links?.length) { setChildren([]); setLoading(false); return; }

      const studentIds = links.map((l: any) => l.student_id);
      const [{ data: students }, { data: grades }, { data: attendance }, { data: fees }] = await Promise.all([
        supabase.from('students').select('*, classes!students_class_id_fkey(name)').eq('school_id', user.schoolId).in('id', studentIds),
        supabase.from('grades').select('*').eq('school_id', user.schoolId).in('student_id', studentIds).order('date', { ascending: true }),
        supabase.from('attendance').select('*').eq('school_id', user.schoolId).in('student_id', studentIds).order('date', { ascending: false }),
        (supabase as any).from('fees').select('*').eq('school_id', user.schoolId).in('student_id', studentIds),
      ]);

      const enriched = (students || []).map(s => {
        const childGrades = (grades || []).filter(g => g.student_id === s.id);
        const childAttendance = (attendance || []).filter(a => a.student_id === s.id);
        const childFees = (fees || []).filter((f: any) => f.student_id === s.id);
        const totalDue = childFees.reduce((sum: number, f: any) => sum + (f.amount_due || 0), 0);
        const totalPaid = childFees.reduce((sum: number, f: any) => sum + (f.amount_paid || 0), 0);
        const presentCount = childAttendance.filter(a => a.status === 'present').length;
        return {
          ...s,
          className: (s as any).classes?.name || '',
          grades: childGrades,
          attendance: childAttendance,
          attendanceRate: childAttendance.length > 0 ? Math.round((presentCount / childAttendance.length) * 100) : 0,
          avgGrade: childGrades.length > 0
            ? Math.round(childGrades.reduce((sum, g) => sum + (g.score / g.max_score) * 100, 0) / childGrades.length)
            : 0,
          feesRemaining: Math.max(0, totalDue - totalPaid),
        };
      });
      setChildren(enriched);
      setLoading(false);
    })();
  }, [user?.id, user?.schoolId]);

  return (
    <div className="flex flex-col gap-12 max-w-[1500px] mx-auto text-right">
      <header className="bg-white/40 backdrop-blur-md p-10 sm:p-14 rounded-[56px] border border-white/50 shadow-xl shadow-slate-200/10 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-10 relative z-10">
          <div className="flex items-center gap-8">
            <div className="w-20 h-20 rounded-[28px] bg-indigo-600 flex items-center justify-center shadow-2xl shadow-indigo-200 rotate-3">
              <Award className="w-10 h-10 text-white" />
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">مرحباً بك، {user?.fullName?.split(' ')[0]}</h1>
              <p className="text-slate-500 text-lg font-medium">بوابتك لمتابعة مسيرة أبنائك التعليمية لحظة بلحظة</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
             <StatsCard title="الطلاب" value={children.length} icon={Users} color="white" />
             <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-200">
               <MessageSquare className="w-6 h-6" />
             </div>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-6 bg-white/40 backdrop-blur-md rounded-[56px] border border-white/50">
          <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-slate-400 font-black tracking-widest text-xs uppercase">جاري مزامنة بيانات العائلة</p>
        </div>
      ) : children.length === 0 ? (
        <div className="premium-card p-24 text-center flex flex-col items-center max-w-3xl mx-auto">
          <div className="w-24 h-24 rounded-[36px] bg-slate-50 flex items-center justify-center mb-10 border border-slate-100">
            <AlertCircle className="w-12 h-12 text-slate-200" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">لا توجد بيانات مرتبطة</h2>
          <p className="text-slate-400 font-medium text-lg leading-relaxed mb-10">
            يرجى التواصل مع إدارة المدرسة لربط حسابك بأبنائك عبر رقم الهاتف المسجل لديهم.
          </p>
          <Button className="h-16 px-12 rounded-2xl bg-slate-900 text-white font-black text-lg">طلب مساعدة من الإدارة</Button>
        </div>
      ) : (
        <div className="space-y-12">
          <div className="flex items-center gap-5 px-6">
            <div className="w-2 h-10 bg-indigo-600 rounded-full" />
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">أبنائي الطلاب</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {children.map(child => (
              <ChildSummaryCard key={child.id} child={child} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChildSummaryCard({ child }: { child: any }) {
  const navigate = () => window.location.assign(`/parent/children/${child.id}`);
  
  return (
    <div className="premium-card p-0 overflow-hidden group hover:scale-[1.02] transition-all duration-500">
      <div className="p-10 space-y-8">
         <div className="flex flex-col items-center text-center gap-4">
            <div className="w-20 h-20 rounded-[28px] bg-slate-50 flex items-center justify-center text-3xl font-black text-slate-900 border border-slate-100 shadow-inner group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
               {child.name.trim()[0]}
            </div>
            <div>
               <h3 className="text-2xl font-black text-slate-900 mb-1">{child.name}</h3>
               <Badge className="bg-slate-100 text-slate-500 border-none font-black text-[10px] uppercase tracking-widest">{child.className || 'بدون فصل'}</Badge>
            </div>
         </div>

         <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-50/50 p-6 rounded-3xl text-center border border-emerald-100/50">
               <p className="text-2xl font-black text-emerald-600">{child.avgGrade}%</p>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">متوسط التحصيل</p>
            </div>
            <div className="bg-indigo-50/50 p-6 rounded-3xl text-center border border-indigo-100/50">
               <p className="text-2xl font-black text-indigo-600">{child.attendanceRate}%</p>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">نسبة الحضور</p>
            </div>
         </div>

         {child.feesRemaining > 0 && (
           <div className="bg-amber-50/50 p-6 rounded-3xl flex items-center justify-between border border-amber-100/50">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-amber-500 shadow-sm border border-amber-100">
                    <Clock className="w-5 h-5" />
                 </div>
                 <p className="text-xs font-black text-amber-900 uppercase tracking-widest">مصاريف معلقة</p>
              </div>
              <p className="text-xl font-black text-amber-600">{child.feesRemaining} <span className="text-xs">ر.س</span></p>
           </div>
         )}
         
         <Button onClick={navigate} className="w-full h-14 rounded-2xl bg-slate-900 text-white font-black group-hover:bg-indigo-600 transition-all flex items-center justify-center gap-3">
           <Eye className="w-5 h-5" />
           عرض التفاصيل الكاملة
         </Button>
      </div>
    </div>
  );
}

function Badge({ children, className }: any) {
  return (
    <span className={cn("px-4 py-1.5 rounded-full", className)}>
      {children}
    </span>
  );
}
