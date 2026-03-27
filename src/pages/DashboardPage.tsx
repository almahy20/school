import { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import StatCard from '@/components/StatCard';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, GraduationCap, UserCheck, School, BookOpen, 
  TrendingUp, Award, ArrowUpRight, Zap, Target,
  CheckCircle, XCircle, Clock, AlertCircle, Eye, X,
  ClipboardList, CalendarCheck, Calendar
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  if (user?.role === 'parent') return <ParentDashboard />;
  if (user?.role === 'teacher') return <TeacherDashboard />;
  return <AdminDashboard />;
}

// ─── Admin Dashboard (Strategy Center) ───────────────────────────────────────────
function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ students: 0, teachers: 0, parents: 0, classes: 0 });

  useEffect(() => {
    Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }),
      supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
      supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'parent'),
      supabase.from('classes').select('id', { count: 'exact', head: true }),
    ]).then(([s, t, p, c]) => {
      setStats({ students: s.count || 0, teachers: t.count || 0, parents: p.count || 0, classes: c.count || 0 });
    });
  }, []);

  return (
    <AppLayout>
      <div className="flex flex-col gap-10 animate-fade-in max-w-[1400px] mx-auto">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="page-header !mb-0 italic tracking-tighter">المركز الإداري</h1>
            <p className="text-primary/40 font-black text-xs uppercase tracking-[0.3em] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              أداء المؤسسة التعليمية اليوم
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">التوجيه المستمر</p>
              <p className="text-sm font-bold text-primary">تحكم كامل، أمان مطلق</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary/5 border-2 border-primary/10 flex items-center justify-center text-primary rotate-3">
              <Zap className="w-6 h-6 fill-primary" />
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          <StatCard title="إجمالي الطلاب" value={stats.students} icon={Users} color="primary" />
          <StatCard title="المعلمون" value={stats.teachers} icon={GraduationCap} color="secondary" />
          <StatCard title="أولياء الأمور" value={stats.parents} icon={UserCheck} color="accent" />
          <StatCard title="إحصائية الفصول" value={stats.classes} icon={School} color="success" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 relative overflow-hidden bg-primary p-12 rounded-[40px] shadow-2xl shadow-primary/20">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-secondary/20 rounded-full -ml-24 -mb-24 blur-3xl" />
            
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-10 text-white">
              <div className="shrink-0 w-24 h-24 rounded-3xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner group transition-transform hover:scale-105 active:scale-95 cursor-pointer">
                <Target className="w-12 h-12 text-secondary group-hover:rotate-12 transition-all" />
              </div>
              <div className="text-center md:text-right space-y-4">
                <h2 className="text-4xl font-black tracking-tight leading-tight">مرحباً بك، {user?.fullName}</h2>
                <p className="text-white/60 font-bold text-lg max-w-2xl leading-relaxed">
                  أنت الآن في عصب النظام الإداري لمؤسسة "إدارة عربية". رؤيتك الاستراتيجية هي التي تدفعنا لتطوير منصة تعليمية ذكية، آمنة، ومتكاملة.
                </p>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-4">
                  <div className="px-6 py-3 rounded-2xl bg-white/10 font-bold text-sm backdrop-blur-md border border-white/5">
                    الاستخدام الحالي: مرتفع
                  </div>
                  <div className="px-6 py-3 rounded-2xl bg-secondary text-primary font-black text-sm shadow-xl shadow-black/20">
                    تقرير المدرسة الموحد
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border-2 border-muted p-8 rounded-[40px] flex flex-col items-center justify-center text-center group active:scale-[0.98] transition-all cursor-pointer hover:border-secondary shadow-sm">
            <div className="w-20 h-20 rounded-3xl bg-secondary/10 flex items-center justify-center text-secondary mb-6 group-hover:scale-110 transition-transform">
              <ArrowUpRight className="w-10 h-10 font-black" />
            </div>
            <h3 className="text-2xl font-black text-primary mb-2">رؤية المستقبل</h3>
            <p className="text-muted-foreground font-bold leading-relaxed mb-6 px-4">استكشاف الفرص المتاحة وتتبع نمو الطلاب الأكاديمي عبر التقارير التحليلية المتقدمة.</p>
            <div className="w-full h-2 bg-muted/40 rounded-full overflow-hidden">
              <div className="h-full bg-secondary w-[85%] animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ─── Teacher Dashboard (Classroom Control) ──────────────────────────────────────
function TeacherDashboard() {
  const { user } = useAuth();
  const [myClasses, setMyClasses] = useState<any[]>([]);
  const [studentCount, setStudentCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase.from('classes').select('*').eq('teacher_id', user.id).then(async ({ data }) => {
      setMyClasses(data || []);
      if (data?.length) {
        const classIds = data.map(c => c.id);
        const { count } = await supabase.from('students').select('id', { count: 'exact', head: true }).in('class_id', classIds);
        setStudentCount(count || 0);
      }
    });
  }, [user]);

  return (
    <AppLayout>
      <div className="flex flex-col gap-10 animate-fade-in max-w-[1400px] mx-auto">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="page-header !mb-0 italic tracking-tighter">بوابة المعلم</h1>
            <p className="text-secondary/40 font-black text-xs uppercase tracking-[0.3em] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              إدارة الفصول والتقييم الأكاديمي
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-secondary/10 border-2 border-secondary/20 flex items-center justify-center text-secondary rotate-3">
            <ClipboardList className="w-6 h-6" />
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          <StatCard title="إجمالي طلابي" value={studentCount} icon={Users} color="primary" />
          <StatCard title="فصولي النشطة" value={myClasses.length} icon={School} color="secondary" />
          <StatCard title="تقييمات اليوم" value="4" icon={CalendarCheck} color="success" />
        </div>

        <div className="bg-white border-2 border-muted p-10 rounded-[40px] relative overflow-hidden group shadow-sm">
          <div className="absolute top-0 left-0 w-32 h-32 bg-secondary/5 rounded-full -ml-16 -mt-16 blur-2xl" />
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 text-right">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-transform">
              <Award className="w-10 h-10" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-black text-primary mb-2">مرحباً يا بطل المعرفة، {user?.fullName}</h2>
              <p className="text-muted-foreground font-bold leading-relaxed max-w-3xl">
                أنت تضع حجر الأساس لمستقبل طلابنا. يمكنك الآن البدء في رصد الدرجات، متابعة الحضور، وتحديث تقارير الأداء بكل سهولة من القائمة الجانبية.
              </p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button className="px-8 py-3 rounded-2xl bg-primary text-white font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">تحديث الدرجات</button>
              <button className="px-8 py-3 rounded-2xl bg-muted text-primary font-bold text-sm hover:bg-muted/50 transition-all">سجل الحضور</button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function gradeInfo(pct: number) {
  if (pct >= 90) return { color: 'text-success', bg: 'bg-success/10', bar: 'bg-success', label: 'ممتاز' };
  if (pct >= 75) return { color: 'text-primary', bg: 'bg-primary/10', bar: 'bg-primary', label: 'جيد جداً' };
  if (pct >= 60) return { color: 'text-warning', bg: 'bg-warning/10', bar: 'bg-warning', label: 'جيد' };
  return { color: 'text-destructive', bg: 'bg-destructive/10', bar: 'bg-destructive', label: 'يحتاج تحسين' };
}

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <Icon className="w-10 h-10 text-muted-foreground/30 mb-2" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

// ─── Child Summary Card (Square grid) ─────────────────────────────────────────
function ChildSummaryCard({ child, onDetail }: { child: any; onDetail: () => void }) {
  const gi = gradeInfo(child.avgGrade);
  const ai = gradeInfo(child.attendanceRate);

  return (
    <div className="bg-card rounded-2xl border shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
      {/* Avatar + name */}
      <div className="flex flex-col items-center text-center gap-2">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary select-none">
          {child.name.trim()[0]}
        </div>
        <div>
          <h3 className="font-bold text-foreground leading-tight">{child.name}</h3>
          {child.className && (
            <span className="text-xs text-muted-foreground mt-0.5 block">{child.className}</span>
          )}
        </div>
      </div>

      {/* Stats — two square tiles */}
      <div className="grid grid-cols-2 gap-2">
        <div className={`rounded-xl p-3 text-center ${gi.bg}`}>
          <p className={`text-xl font-bold ${gi.color}`}>{child.avgGrade > 0 ? `${child.avgGrade}%` : '—'}</p>
          <p className="text-xs text-muted-foreground mt-0.5">الدرجات</p>
          {child.avgGrade > 0 && <p className={`text-[11px] font-medium ${gi.color} mt-0.5`}>{gi.label}</p>}
        </div>
        <div className={`rounded-xl p-3 text-center ${ai.bg}`}>
          <p className={`text-xl font-bold ${ai.color}`}>{child.attendanceRate > 0 ? `${child.attendanceRate}%` : '—'}</p>
          <p className="text-xs text-muted-foreground mt-0.5">الحضور</p>
          {child.attendanceRate > 0 && <p className={`text-[11px] font-medium ${ai.color} mt-0.5`}>{ai.label}</p>}
        </div>
      </div>

      {/* Detail button */}
      <button
        onClick={onDetail}
        className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
      >
        <Eye className="w-4 h-4" />
        عرض التفاصيل
      </button>
    </div>
  );
}

// ─── Grades timeline grouped by subject ───────────────────────────────────────
function GradesView({ grades }: { grades: any[] }) {
  const bySubject: Record<string, any[]> = {};
  grades.forEach(g => {
    if (!bySubject[g.subject]) bySubject[g.subject] = [];
    bySubject[g.subject].push(g);
  });
  Object.keys(bySubject).forEach(sub => {
    bySubject[sub].sort((a, b) => a.date.localeCompare(b.date));
  });

  if (Object.keys(bySubject).length === 0)
    return <EmptyState icon={BookOpen} text="لا توجد درجات مسجلة حتى الآن" />;

  return (
    <div className="space-y-4">
      {Object.entries(bySubject).map(([subject, subGrades]) => {
        const avg = Math.round(
          subGrades.reduce((s, g) => s + (g.score / g.max_score) * 100, 0) / subGrades.length
        );
        const gi = gradeInfo(avg);
        return (
          <div key={subject} className="rounded-2xl border overflow-hidden">
            {/* Subject header */}
            <div className={`px-4 py-3 flex items-center justify-between ${gi.bg}`}>
              <div className="flex items-center gap-2">
                <BookOpen className={`w-4 h-4 ${gi.color}`} />
                <span className="font-bold text-foreground">{subject}</span>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full bg-background/60 ${gi.color}`}>
                متوسط {avg}% · {gi.label}
              </span>
            </div>

            {/* Each exam row */}
            <div className="divide-y divide-border">
              {subGrades.map((g: any, idx: number) => {
                const pct = Math.round((g.score / g.max_score) * 100);
                const egi = gradeInfo(pct);
                const dateStr = g.date
                  ? new Date(g.date).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })
                  : '';
                return (
                  <div key={g.id} className="px-4 py-3 flex items-center gap-3">
                    {/* Exam index badge */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${egi.bg} ${egi.color}`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground">{g.term || `اختبار ${idx + 1}`}</p>
                        <p className="text-xs text-muted-foreground">{dateStr}</p>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted mt-1.5 overflow-hidden">
                        <div className={`h-full rounded-full ${egi.bar}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="text-left shrink-0 min-w-[52px]">
                      <p className={`text-sm font-bold ${egi.color}`}>{g.score}/{g.max_score}</p>
                      <p className={`text-[11px] ${egi.color}`}>{egi.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Attendance view grouped by month ─────────────────────────────────────────
function AttendanceView({ attendance }: { attendance: any[] }) {
  const byMonth: Record<string, any[]> = {};
  attendance.forEach(a => {
    const month = a.date?.slice(0, 7);
    if (!month) return;
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push(a);
  });
  const months = Object.keys(byMonth).sort().reverse();

  if (months.length === 0)
    return <EmptyState icon={Calendar} text="لا يوجد سجل حضور حتى الآن" />;

  const monthLabel = (key: string) =>
    new Date(key + '-01').toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      {months.map(month => {
        const records = byMonth[month];
        const present = records.filter(a => a.status === 'present').length;
        const late = records.filter(a => a.status === 'late').length;
        const absent = records.filter(a => a.status === 'absent').length;
        const rate = Math.round(((present + late) / records.length) * 100);
        const ri = gradeInfo(rate);

        return (
          <div key={month} className="bg-muted/30 rounded-2xl p-4">
            {/* Month header */}
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-foreground">{monthLabel(month)}</span>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${ri.bg} ${ri.color}`}>
                {ri.label}
              </span>
            </div>

            {/* Stats tiles */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-success/10 rounded-xl p-2.5 text-center">
                <CheckCircle className="w-4 h-4 text-success mx-auto mb-1" />
                <p className="text-lg font-bold text-success">{present}</p>
                <p className="text-xs text-muted-foreground">حاضر</p>
              </div>
              <div className="bg-warning/10 rounded-xl p-2.5 text-center">
                <Clock className="w-4 h-4 text-warning mx-auto mb-1" />
                <p className="text-lg font-bold text-warning">{late}</p>
                <p className="text-xs text-muted-foreground">متأخر</p>
              </div>
              <div className="bg-destructive/10 rounded-xl p-2.5 text-center">
                <XCircle className="w-4 h-4 text-destructive mx-auto mb-1" />
                <p className="text-lg font-bold text-destructive">{absent}</p>
                <p className="text-xs text-muted-foreground">غائب</p>
              </div>
            </div>

            {/* Day squares */}
            <div className="flex flex-wrap gap-1.5">
              {records
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((a: any) => (
                  <div
                    key={a.id}
                    title={a.date}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-semibold ${
                      a.status === 'present'
                        ? 'bg-success/20 text-success'
                        : a.status === 'late'
                        ? 'bg-warning/20 text-warning'
                        : 'bg-destructive/20 text-destructive'
                    }`}
                  >
                    {a.date?.slice(8)}
                  </div>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Child Detail Modal ───────────────────────────────────────────────────────
function ChildDetailModal({ child, onClose }: { child: any; onClose: () => void }) {
  const [tab, setTab] = useState<'grades' | 'attendance'>('grades');
  const gi = gradeInfo(child.avgGrade);
  const ai = gradeInfo(child.attendanceRate);

  return (
    <div
      className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-background w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl border max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-xl font-bold text-primary select-none">
              {child.name.trim()[0]}
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{child.name}</h2>
              {child.className && <p className="text-sm text-muted-foreground">{child.className}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 gap-3 px-6 py-4 shrink-0">
          <div className={`rounded-xl p-3 text-center ${gi.bg}`}>
            <p className={`text-2xl font-bold ${gi.color}`}>{child.avgGrade > 0 ? `${child.avgGrade}%` : '—'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">متوسط الدرجات</p>
            {child.avgGrade > 0 && <p className={`text-xs font-medium ${gi.color}`}>{gi.label}</p>}
          </div>
          <div className={`rounded-xl p-3 text-center ${ai.bg}`}>
            <p className={`text-2xl font-bold ${ai.color}`}>{child.attendanceRate > 0 ? `${child.attendanceRate}%` : '—'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">نسبة الحضور</p>
            {child.attendanceRate > 0 && <p className={`text-xs font-medium ${ai.color}`}>{ai.label}</p>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6 shrink-0">
          {([
            { id: 'grades', label: 'الدرجات', icon: BookOpen, count: child.grades.length },
            { id: 'attendance', label: 'الحضور', icon: Calendar, count: child.attendance.length },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              <span className="px-1.5 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground ms-1">
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'grades'
            ? <GradesView grades={child.grades} />
            : <AttendanceView attendance={child.attendance} />
          }
        </div>
      </div>
    </div>
  );
}

// ─── Parent Dashboard (Family Portal) ───────────────────────────────────────
function ParentDashboard() {
  const { user } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState<any | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: links } = await supabase
        .from('student_parents')
        .select('student_id')
        .eq('parent_id', user.id);

      if (!links?.length) { setChildren([]); setLoading(false); return; }

      const studentIds = links.map(l => l.student_id);
      const [{ data: students }, { data: grades }, { data: attendance }] = await Promise.all([
        supabase.from('students').select('*, classes!students_class_id_fkey(name)').in('id', studentIds),
        supabase.from('grades').select('*').in('student_id', studentIds).order('date', { ascending: true }),
        supabase.from('attendance').select('*').in('student_id', studentIds).order('date', { ascending: false }),
      ]);

      const enriched = (students || []).map(s => {
        const childGrades = (grades || []).filter(g => g.student_id === s.id);
        const childAttendance = (attendance || []).filter(a => a.student_id === s.id);
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
        };
      });
      setChildren(enriched);
      setLoading(false);
    })();
  }, [user]);

  const overallAvg = children.length > 0
    ? Math.round(children.reduce((s, c) => s + c.avgGrade, 0) / children.length) : 0;
  const overallAtt = children.length > 0
    ? Math.round(children.reduce((s, c) => s + c.attendanceRate, 0) / children.length) : 0;

  return (
    <AppLayout>
      <div className="flex flex-col gap-10 animate-fade-in max-w-[1400px] mx-auto">
        {/* Welcome */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-primary p-12 rounded-[40px] text-white shadow-2xl shadow-primary/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="relative z-10 flex items-center gap-8">
            <div className="w-20 h-20 rounded-3xl bg-secondary flex items-center justify-center shadow-xl rotate-3">
              <Award className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight mb-2">مرحباً، {user?.fullName} 👋</h1>
              <p className="text-white/60 font-bold text-lg">متابعة دقيقة لمسار أبنائك التعليمي في مكان واحد.</p>
            </div>
          </div>
          {children.length > 0 && (
            <div className="relative z-10 px-8 py-4 rounded-3xl bg-white/10 border border-white/5 backdrop-blur-md">
              <p className="text-xs font-black text-white/50 uppercase tracking-widest mb-1">حمولة العائلة</p>
              <p className="text-xl font-black">{children.length} {children.length === 1 ? 'ابن/ابنة' : 'أبناء'}</p>
            </div>
          )}
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 bg-muted/10 rounded-[40px] border-2 border-dashed border-muted">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-black text-primary/40 uppercase tracking-widest">جارٍ تأمين اتصالك بالبيانات الأسرية…</p>
          </div>
        ) : children.length === 0 ? (
          <div className="bg-white border-2 border-muted p-16 text-center rounded-[40px]">
            <div className="w-20 h-20 rounded-3xl bg-muted/50 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-black text-primary mb-3">لم يتم ربط أبنائك بعد</h2>
            <p className="text-muted-foreground font-bold max-w-sm mx-auto leading-relaxed">
              يرجى التواصل مع إدارة المدرسة فوراً لربط أبنائك بحسابك عبر رقم الهاتف الخاص بك المسجل لديهم.
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Summary stats tiles */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              <div className="premium-card p-8 bg-white border-2 border-muted flex flex-col items-center text-center group hover:border-primary transition-all">
                <Users className="w-8 h-8 text-primary/20 mb-4 group-hover:scale-110 transition-transform" />
                <p className="text-4xl font-black text-primary italic tracking-tighter mb-1">{children.length}</p>
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">إجمالي الأبناء</p>
              </div>
              <div className="premium-card p-8 bg-white border-2 border-muted flex flex-col items-center text-center group hover:border-secondary transition-all">
                <TrendingUp className="w-8 h-8 text-secondary/20 mb-4 group-hover:scale-110 transition-transform" />
                <p className="text-4xl font-black text-secondary italic tracking-tighter mb-1">{overallAvg}%</p>
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">متوسط التحصيل</p>
              </div>
              <div className="premium-card p-8 bg-white border-2 border-muted flex flex-col items-center text-center group hover:border-emerald-500 transition-all">
                <Calendar className="w-8 h-8 text-emerald-500/20 mb-4 group-hover:scale-110 transition-transform" />
                <p className="text-4xl font-black text-emerald-600 italic tracking-tighter mb-1">{overallAtt}%</p>
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">متوسط الحضور</p>
              </div>
            </div>

            {/* Children grid */}
            <div>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-2 h-8 bg-secondary rounded-full" />
                <h2 className="text-2xl font-black text-primary tracking-tight">نافذة الأبناء</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {children.map(child => (
                  <ChildSummaryCard
                    key={child.id}
                    child={child}
                    onDetail={() => setSelectedChild(child)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedChild && (
        <ChildDetailModal child={selectedChild} onClose={() => setSelectedChild(null)} />
      )}
    </AppLayout>
  );
}
