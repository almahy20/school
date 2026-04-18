import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowRight, Eye, BookOpen, Calendar, X, 
  User, CreditCard, Layers, Phone, Mail, 
  MapPin, Hash, CheckCircle2, Clock, AlertCircle,
  MessageSquare
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useChildFullDetails, useCreateComplaint } from '@/hooks/queries';
import { cn } from '@/lib/utils';
import { QueryStateHandler } from '@/components/QueryStateHandler';

function gradeInfo(pct: number) {
  if (pct >= 90) return { color: 'text-emerald-600', bg: 'bg-emerald-50', bar: 'bg-emerald-500', label: 'ممتاز' };
  if (pct >= 75) return { color: 'text-primary', bg: 'bg-primary/5', bar: 'bg-primary', label: 'جيد جداً' };
  if (pct >= 60) return { color: 'text-amber-600', bg: 'bg-amber-50', bar: 'bg-amber-500', label: 'جيد' };
  return { color: 'text-rose-600', bg: 'bg-rose-50', bar: 'bg-rose-500', label: 'يحتاج تحسين' };
}

export default function ParentChildDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const { data: child, isLoading, error, refetch } = useChildFullDetails(id);
  const [tab, setTab] = useState<'grades' | 'attendance' | 'financial' | 'curriculum' | 'data'>('grades');
  const createComplaint = useCreateComplaint();
  const [comment, setComment] = useState('');

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !user || !id) return;
    
    try {
      await createComplaint.mutateAsync({
        studentId: id,
        content: comment.trim(),
      });
      toast({ title: 'تم إرسال التعليق' });
      setComment('');
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const gi = child ? gradeInfo(child.avgGrade) : { color: '', bg: '', bar: '', label: '' };
  const ai = child ? gradeInfo(child.attendanceRate) : { color: '', bg: '', bar: '', label: '' };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20" dir="rtl">
        <QueryStateHandler
          loading={isLoading}
          error={error}
          data={child}
          onRetry={refetch}
          loadingMessage="جاري مزامنة بيانات الطالب بالكامل..."
        >
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 md:pb-10 border-b border-slate-100">
            <div className="flex items-center gap-4 md:gap-6 text-right translate-x-0">
              <button
                onClick={() => navigate('/')}
                className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-white text-slate-400 hover:text-slate-900 border border-slate-100 flex items-center justify-center transition-all active:scale-95 shadow-sm shrink-0"
              >
                <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
              </button>
              <div className="flex items-center gap-3 md:gap-4">
                 <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl md:rounded-[24px] bg-slate-900 flex items-center justify-center text-white text-xl md:text-2xl font-black shadow-xl shadow-slate-200 shrink-0">
                    {child?.name?.[0]}
                 </div>
                 <div className="min-w-0">
                   <h1 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight leading-tight mb-1 md:mb-2 truncate">{child?.name}</h1>
                   <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-indigo-50 border-indigo-100 text-indigo-600 font-black text-[9px] md:text-[10px] py-0.5">{child?.className || 'بدون فصل'}</Badge>
                      <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{child?.academic_year || '2025/2026'}</span>
                   </div>
                 </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <div className="px-5 md:px-8 py-3.5 md:py-5 rounded-[20px] md:rounded-[32px] bg-white border border-slate-100 shadow-sm relative z-10 flex items-center gap-4 group hover:scale-[1.02] transition-all">
                 <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-slate-900 group-hover:text-white transition-colors shrink-0">
                   <Calendar className="w-5 h-5 md:w-7 md:h-7" />
                 </div>
                 <div className="min-w-0">
                   <p className="text-[8px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1 md:mb-2 text-right">اليوم</p>
                   <p className="text-sm md:text-xl font-black text-slate-900 leading-none text-right truncate">{new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                 </div>
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className={cn("premium-card p-6 flex flex-col justify-between border shadow-sm", gi.bg)}>
                    <div className="flex items-center justify-between mb-4">
                       <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-white/50", gi.color)}>
                          <BookOpen className="w-5 h-5" />
                       </div>
                       <Badge className={cn("bg-white/50 border-none font-black text-[9px]", gi.color)}>{gi.label}</Badge>
                    </div>
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">متوسط التحصيل</p>
                       <h3 className={cn("text-3xl font-black leading-none", gi.color)}>{child?.avgGrade ? `${child.avgGrade}%` : '—'}</h3>
                    </div>
                 </div>

                 <div className={cn("premium-card p-6 flex flex-col justify-between border shadow-sm", ai.bg)}>
                    <div className="flex items-center justify-between mb-4">
                       <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-white/50", ai.color)}>
                          <Calendar className="w-5 h-5" />
                       </div>
                       <Badge className={cn("bg-white/50 border-none font-black text-[9px]", ai.color)}>منتظم</Badge>
                    </div>
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">نسبة الحضور</p>
                       <h3 className={cn("text-3xl font-black leading-none", ai.color)}>{child?.attendanceRate ? `${child.attendanceRate}%` : '—'}</h3>
                    </div>
                 </div>

                 <div className="premium-card p-6 flex flex-col justify-between border border-slate-100 bg-slate-50 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                       <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white text-slate-400">
                          <CreditCard className="w-5 h-5" />
                       </div>
                       <Badge className="bg-white border-slate-100 text-slate-400 font-black text-[9px]">مستحق</Badge>
                    </div>
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">المتبقي من الرسوم</p>
                       <h3 className="text-3xl font-black leading-none text-slate-900">{child?.feesRemaining?.toLocaleString()} <span className="text-sm">ج.م</span></h3>
                    </div>
                 </div>
              </div>

              <section className="bg-white border border-slate-100 rounded-[32px] md:rounded-[40px] p-1 md:p-2 space-y-6 shadow-sm overflow-hidden">
                <div className="flex overflow-x-auto hide-scrollbar gap-1 p-1.5 md:p-2 bg-slate-50/50 rounded-[28px] md:rounded-[32px] -mx-0.5">
                  {[
                    { id: 'grades', label: 'الدرجات', icon: BookOpen },
                    { id: 'attendance', label: 'الحضور', icon: Calendar },
                    { id: 'curriculum', label: 'المنهج', icon: Layers },
                    { id: 'financial', label: 'المصروفات', icon: CreditCard },
                    { id: 'data', label: 'بيانات الطفل', icon: User },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id as any)}
                      className={cn(
                        "flex-1 min-w-[80px] md:min-w-[100px] py-3 md:py-4 rounded-[20px] md:rounded-[24px] text-[10px] md:text-xs font-black flex items-center justify-center gap-2 transition-all duration-300 shrink-0",
                        tab === t.id 
                          ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/20' 
                          : 'text-slate-400 hover:bg-white hover:text-slate-600'
                      )}
                    >
                      <t.icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      {t.label}
                    </button>
                  ))}
                </div>
                
                <div className="p-6 pt-0 animate-in fade-in duration-500">
                  {tab === 'grades' ? (
                    <GradesView grades={child?.grades || []} />
                  ) : tab === 'attendance' ? (
                    <AttendanceView attendance={child?.attendance || []} />
                  ) : tab === 'curriculum' ? (
                    <CurriculumView subjects={child?.curriculum || []} />
                  ) : tab === 'data' ? (
                    <ChildDataView child={child} />
                  ) : (
                    <FinancialView fees={child?.fees || []} payments={child?.payments || []} totalDue={child?.feesRemaining || 0} />
                  )}
                </div>
              </section>
            </div>

            <div className="space-y-10">
              <section className="bg-white border border-slate-100 rounded-[40px] p-8 space-y-6 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-1000" />
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-3 relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                     <MessageSquare className="w-5 h-5" />
                  </div>
                  تواصل مع الإدارة
                </h2>
                <form onSubmit={submitComment} className="space-y-4 relative z-10">
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    className="w-full h-32 rounded-3xl border border-slate-100 bg-slate-50/50 p-5 text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:bg-white focus:border-indigo-500/20 transition-all resize-none"
                    placeholder="اكتب استفسارك أو شكواك هنا..."
                  />
                  <button
                    type="submit"
                    disabled={createComplaint.isPending}
                    className="w-full h-14 rounded-2xl bg-slate-900 text-white font-black text-sm shadow-xl shadow-slate-900/10 hover:shadow-2xl hover:translate-y-[-2px] active:scale-95 transition-all disabled:opacity-50"
                  >
                    {createComplaint.isPending ? 'جاري الإرسال...' : 'إرسال الرسالة'}
                  </button>
                </form>
              </section>
              
              <section className="bg-indigo-600 rounded-[40px] p-8 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden group">
                 <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />
                 <div className="relative z-10 space-y-6">
                    <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                       <Layers className="w-7 h-7" />
                    </div>
                    <div className="space-y-2">
                       <h3 className="text-2xl font-black tracking-tight">الجدول الدراسي</h3>
                       <p className="text-white/60 text-xs font-bold leading-relaxed uppercase tracking-widest">متاح قريباً في التحديث القادم</p>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                       <div className="h-full bg-white/40 w-[85%] rounded-full animate-pulse" />
                    </div>
                 </div>
              </section>
            </div>
          </div>
        </QueryStateHandler>
      </div>
    </AppLayout>
  );
}

function GradesView({ grades }: { grades: any[] }) {
  const bySubject: Record<string, any[]> = {};
  grades.forEach(g => {
    if (!bySubject[g.subject]) bySubject[g.subject] = [];
    bySubject[g.subject].push(g);
  });
  
  if (Object.keys(bySubject).length === 0)
    return (
      <div className="py-20 text-center space-y-4">
        <div className="w-20 h-20 rounded-[32px] bg-slate-50 flex items-center justify-center text-slate-200 mx-auto border border-slate-100">
           <BookOpen className="w-10 h-10" />
        </div>
        <p className="text-slate-400 font-black text-sm tracking-widest uppercase">لا توجد درجات مسجلة حتى الآن</p>
      </div>
    );

  return (
    <div className="space-y-8">
      {Object.entries(bySubject).map(([subject, subGrades]) => {
        const numericGrades = subGrades.filter(g => !isNaN(Number(g.score)));
        const avg = numericGrades.length > 0 
          ? Math.round(numericGrades.reduce((s, g) => s + (Number(g.score) / g.max_score) * 100, 0) / numericGrades.length)
          : 0;
        
        const gi = gradeInfo(avg || 100);
        return (
          <div key={subject} className="rounded-[32px] border border-slate-100 overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
            <div className={cn("px-8 py-5 flex items-center justify-between", gi.bg)}>
              <div className="flex items-center gap-3">
                 <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center bg-white/80", gi.color)}>
                    <BookOpen className="w-4 h-4" />
                 </div>
                 <span className="font-black text-slate-900">{subject}</span>
              </div>
              {numericGrades.length > 0 && (
                <Badge className={cn("bg-white border-none font-black text-[10px] px-4 py-1.5 rounded-full shadow-sm", gi.color)}>
                  المتوسط {avg}%
                </Badge>
              )}
            </div>
            <div className="divide-y divide-slate-50 px-4">
              {subGrades.map((g: any, idx) => {
                const isNumeric = !isNaN(Number(g.score));
                const pct = isNumeric ? (Number(g.score) / g.max_score) * 100 : 100;
                const itemGi = gradeInfo(pct);
                
                return (
                  <div key={g.id} className="px-4 py-5 flex items-center justify-between group">
                    <div className="space-y-1.5">
                      <p className="text-sm font-black text-slate-700 group-hover:text-indigo-600 transition-colors">{g.term || `اختبار ${idx + 1}`}</p>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                         <Calendar className="w-3 h-3" />
                         {new Date(g.date).toLocaleDateString('ar-EG')}
                      </div>
                    </div>
                    <div className="text-right">
                       <p className={cn("text-xl font-black", itemGi.color)}>
                          {g.score}
                          {isNumeric && <span className="text-[10px] text-slate-300 mx-1">/ {g.max_score}</span>}
                       </p>
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

function AttendanceView({ attendance }: { attendance: any[] }) {
  if (attendance.length === 0)
    return (
      <div className="py-20 text-center space-y-4">
        <div className="w-20 h-20 rounded-[32px] bg-slate-50 flex items-center justify-center text-slate-200 mx-auto border border-slate-100">
           <Calendar className="w-10 h-10" />
        </div>
        <p className="text-slate-400 font-black text-sm tracking-widest uppercase">لا يوجد سجل حضور مسجل</p>
      </div>
    );

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-center gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
         <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-200" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">حاضر</span>
         </div>
         <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500 shadow-lg shadow-rose-200" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">غائب</span>
         </div>
         <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500 shadow-lg shadow-amber-200" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">متأخر</span>
         </div>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 gap-3">
        {attendance.map((a: any) => (
          <div
            key={a.id}
            title={`${a.date} - ${a.status}`}
            className={cn(
              "h-16 rounded-2xl flex flex-col items-center justify-center border-2 transition-all hover:scale-105 cursor-default",
              a.status === 'present' ? 'bg-emerald-50 border-emerald-100 text-emerald-600 shadow-sm' :
              a.status === 'late' ? 'bg-amber-50 border-amber-100 text-amber-600 shadow-sm' :
              'bg-rose-50 border-rose-100 text-rose-600 shadow-sm'
            )}
          >
            <span className="text-sm font-black leading-none mb-1">{new Date(a.date).getDate()}</span>
            <span className="text-[8px] font-black uppercase tracking-tighter opacity-70">{new Date(a.date).toLocaleDateString('ar-EG', { month: 'short' })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CurriculumView({ subjects }: { subjects: any[] }) {
  if (subjects.length === 0)
    return (
      <div className="py-20 text-center space-y-4">
        <div className="w-20 h-20 rounded-[32px] bg-slate-50 flex items-center justify-center text-slate-200 mx-auto border border-slate-100">
           <Layers className="w-10 h-10" />
        </div>
        <p className="text-slate-400 font-black text-sm tracking-widest uppercase">لم يتم تحديد المنهج لهذا الفصل بعد</p>
      </div>
    );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {subjects.map((sub: any) => (
        <div key={sub.id} className="p-8 rounded-[32px] bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:translate-y-[-4px] transition-all group">
          <div className="flex items-center gap-4 mb-6">
             <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
                <BookOpen className="w-6 h-6" />
             </div>
             <h3 className="text-xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{sub.subject_name}</h3>
          </div>
          <div className="p-5 rounded-2xl bg-slate-50/50 border border-slate-100 text-slate-500 text-sm font-medium leading-relaxed">
             {sub.content || 'لا توجد تفاصيل متاحة لهذا المنهج حالياً.'}
          </div>
        </div>
      ))}
    </div>
  );
}

function ChildDataView({ child }: { child: any }) {
  const infoItems = [
    { label: 'الاسم الكامل', value: child?.name, icon: User },
    { label: 'رقم القيد', value: child?.id?.split('-')[0].toUpperCase(), icon: Hash },
    { label: 'السنة الدراسية', value: child?.academic_year || '2025/2026', icon: Calendar },
    { label: 'هاتف ولي الأمر', value: child?.parent_phone || 'غير مسجل', icon: Phone },
    { label: 'العنوان السكني', value: child?.address || 'غير مسجل', icon: MapPin },
    { label: 'تاريخ الميلاد', value: child?.birth_date ? new Date(child.birth_date).toLocaleDateString('ar-EG') : 'غير مسجل', icon: Calendar },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {infoItems.map((item, idx) => (
        <div key={idx} className="flex items-center gap-5 p-6 rounded-3xl bg-white border border-slate-50 shadow-sm">
           <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center shrink-0 border border-slate-100">
              <item.icon className="w-5 h-5" />
           </div>
           <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{item.label}</p>
              <p className="text-sm font-black text-slate-700">{item.value}</p>
           </div>
        </div>
      ))}
    </div>
  );
}

function FinancialView({ fees = [], payments = [], totalDue }: { fees: any[], payments: any[], totalDue: number }) {
  const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  if (fees.length === 0 && payments.length === 0 && totalDue === 0)
    return (
      <div className="py-20 text-center space-y-4">
        <div className="w-20 h-20 rounded-[32px] bg-slate-50 flex items-center justify-center text-slate-200 mx-auto border border-slate-100">
           <CreditCard className="w-10 h-10" />
        </div>
        <p className="text-slate-400 font-black text-sm tracking-widest uppercase">لا توجد سجلات مالية مسجلة</p>
      </div>
    );

  return (
    <div className="space-y-12">
      <div className="space-y-6">
        <h3 className="text-lg font-black text-slate-900 px-2 flex items-center gap-3">
           <Clock className="w-5 h-5 text-indigo-500" />
           كشف المصروفات الشهرية
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fees.sort((a,b) => (b.year*12 + b.month) - (a.year*12 + a.month)).map((f: any) => (
            <div key={f.id} className="p-6 rounded-3xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      f.status === 'paid' ? "bg-emerald-50 text-emerald-600" : f.status === 'partial' ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                    )}>
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                       <p className="text-sm font-black text-slate-900">شهر {MONTHS_AR[f.month - 1]} {f.year}</p>
                       <p className="text-[10px] font-bold text-slate-400">{f.term}</p>
                    </div>
                 </div>
                 <Badge className={cn(
                   "border-none font-black text-[9px] px-3 py-1 rounded-lg",
                   f.status === 'paid' ? "bg-emerald-50 text-emerald-600" : f.status === 'partial' ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                 )}>
                   {f.status === 'paid' ? 'تم السداد' : f.status === 'partial' ? 'سداد جزئي' : 'غير مسدد'}
                 </Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50">
                <div>
                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">المطلوب</p>
                   <p className="text-sm font-black text-slate-900">{f.amount_due} ج.م</p>
                </div>
                <div className="text-left">
                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">المسدد</p>
                   <p className="text-sm font-black text-indigo-600">{f.amount_paid} ج.م</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {totalDue > 0 && (
         <div className="p-8 rounded-[32px] bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl shadow-slate-200">
            <div className="flex items-center gap-5">
               <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md">
                  <AlertCircle className="w-8 h-8 text-rose-400" />
               </div>
               <div>
                  <h3 className="text-xl font-black">إجمالي الرسوم المتبقية</h3>
                  <p className="text-white/40 text-sm font-bold mt-1">المبلغ الإجمالي لكافة الأشهر غير المسددة.</p>
               </div>
            </div>
            <div className="text-center md:text-left">
               <p className="text-3xl font-black text-white">{totalDue.toLocaleString()} <span className="text-sm opacity-40">ج.م</span></p>
            </div>
         </div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-black text-slate-900 px-2 flex items-center gap-3">
           <CheckCircle2 className="w-5 h-5 text-emerald-500" />
           سجل المدفوعات الأخيرة
        </h3>
        {payments.length === 0 ? (
          <p className="p-10 text-center text-slate-400 font-bold bg-slate-50 rounded-3xl border border-dashed border-slate-200">لا يوجد سجل مدفوعات حالياً</p>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {payments.map((p: any) => (
              <div key={p.id} className="p-6 rounded-3xl border border-slate-100 bg-white flex items-center justify-between hover:shadow-xl hover:translate-x-[-4px] transition-all group">
                <div className="flex items-center gap-5">
                   <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all duration-500">
                      <CreditCard className="w-6 h-6" />
                   </div>
                   <div>
                      <p className="text-lg font-black text-slate-900">{p.amount.toLocaleString()} ج.م</p>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                         <span className="uppercase tracking-widest">{p.payment_method === 'Cash' ? 'نقدي' : p.payment_method === 'Card' ? 'بطاقة' : 'تحويل'}</span>
                         <span className="w-1 h-1 rounded-full bg-slate-200" />
                         <span>{new Date(p.payment_date).toLocaleDateString('ar-EG')}</span>
                      </div>
                   </div>
                </div>
                <Badge className="bg-emerald-50 text-emerald-600 border-none font-black text-[10px] px-4 py-1.5 rounded-full">تم التأكيد</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
