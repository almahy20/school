import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowRight, BookOpen, Calendar, 
  User, CreditCard, Layers, 
  MessageSquare
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useChildFullDetails, useCreateComplaint } from '@/hooks/queries';
import { cn } from '@/lib/utils';
import { QueryStateHandler } from '@/components/QueryStateHandler';

// Interactive Card Component - Opens detail page
function InteractiveCard({ 
  title, 
  icon: Icon, 
  value,
  subtitle,
  color,
  onClick,
  badge
}: { 
  title: string; 
  icon: any; 
  value?: string;
  subtitle?: string;
  color: string;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="group bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-right"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", color)}>
          <Icon className="w-6 h-6" />
        </div>
        {badge && (
          <Badge className="bg-slate-100 text-slate-600 border-none text-[10px] font-bold">
            {badge}
          </Badge>
        )}
      </div>
      
      <h3 className="font-bold text-slate-900 mb-1">{title}</h3>
      {value && (
        <p className="text-2xl font-black text-slate-900 mb-1">{value}</p>
      )}
      {subtitle && (
        <p className="text-xs text-slate-500 font-medium">{subtitle}</p>
      )}
      
      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 group-hover:text-indigo-600 transition-colors">
        <span>عرض التفاصيل</span>
        <ArrowRight className="w-4 h-4 rtl:rotate-180 group-hover:translate-x-1 transition-transform" />
      </div>
    </button>
  );
}

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
      <div className="max-w-6xl mx-auto space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 px-2 md:px-0" dir="rtl">
        <QueryStateHandler
          loading={isLoading}
          error={error}
          data={child}
          onRetry={refetch}
          loadingMessage="جاري مزامنة بيانات الطالب بالكامل..."
        >
          {/* Header */}
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

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className={cn("premium-card p-5 flex flex-col justify-between border shadow-sm", gi.bg)}>
                <div className="flex items-center justify-between mb-3">
                   <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center bg-white/50", gi.color)}>
                      <BookOpen className="w-4 h-4" />
                   </div>
                   <Badge className={cn("bg-white/50 border-none font-bold text-[8px]", gi.color)}>{gi.label}</Badge>
                </div>
                <div>
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">متوسط التحصيل</p>
                   <h3 className={cn("text-2xl font-black leading-none", gi.color)}>{child?.avgGrade ? `${child.avgGrade}%` : '—'}</h3>
                </div>
             </div>

             <div className={cn("premium-card p-5 flex flex-col justify-between border shadow-sm", ai.bg)}>
                <div className="flex items-center justify-between mb-3">
                   <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center bg-white/50", ai.color)}>
                      <Calendar className="w-4 h-4" />
                   </div>
                   <Badge className={cn("bg-white/50 border-none font-bold text-[8px]", ai.color)}>منتظم</Badge>
                </div>
                <div>
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">نسبة الحضور</p>
                   <h3 className={cn("text-2xl font-black leading-none", ai.color)}>{child?.attendanceRate ? `${child.attendanceRate}%` : '—'}</h3>
                </div>
             </div>

             <div className="premium-card p-5 flex flex-col justify-between border border-slate-100 bg-slate-50 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                   <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-white text-slate-400">
                      <CreditCard className="w-4 h-4" />
                   </div>
                   <Badge className="bg-white border-slate-100 text-slate-400 font-bold text-[8px]">مستحق</Badge>
                </div>
                <div>
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">المتبقي من الرسوم</p>
                   <h3 className="text-2xl font-black leading-none text-slate-900">{child?.feesRemaining?.toLocaleString()} <span className="text-xs">ج.م</span></h3>
                </div>
             </div>
          </div>

          {/* Interactive Cards Grid */}
          <section>
            <h2 className="text-2xl font-black text-slate-900 mb-6">التفاصيل الكاملة</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Grades Card */}
              <InteractiveCard
                title="الدرجات"
                icon={BookOpen}
                value={child?.avgGrade ? `${child.avgGrade}%` : '—'}
                subtitle={child?.grades?.length ? `${child.grades.length} درجة مسجلة` : 'لا توجد درجات'}
                color="bg-indigo-50 text-indigo-600"
                badge={gi.label}
                onClick={() => navigate(`/parent/children/${id}/grades`)}
              />

              {/* Attendance Card */}
              <InteractiveCard
                title="الحضور والغياب"
                icon={Calendar}
                value={child?.attendanceRate ? `${child.attendanceRate}%` : '—'}
                subtitle={child?.attendance?.length ? `${child.attendance.length} يوم مسجل` : 'لا يوجد سجل'}
                color="bg-emerald-50 text-emerald-600"
                badge="منتظم"
                onClick={() => navigate(`/parent/children/${id}/attendance`)}
              />

              {/* Financial Card */}
              <InteractiveCard
                title="المصروفات"
                icon={CreditCard}
                value={child?.feesRemaining ? `${child.feesRemaining} ج.م` : '—'}
                subtitle={child?.fees?.length ? `${child.fees.length} قسط` : 'لا توجد مصروفات'}
                color="bg-amber-50 text-amber-600"
                badge="مستحق"
                onClick={() => navigate(`/parent/children/${id}/financial`)}
              />

              {/* Curriculum Card */}
              <InteractiveCard
                title="المنهج الدراسي"
                icon={Layers}
                value={child?.curriculum?.length ? `${child.curriculum.length} مواد` : '—'}
                subtitle="المواد والمناهج"
                color="bg-purple-50 text-purple-600"
                onClick={() => navigate(`/parent/children/${id}/curriculum`)}
              />

              {/* Student Data Card */}
              <InteractiveCard
                title="بيانات الطالب"
                icon={User}
                subtitle="المعلومات الشخصية"
                color="bg-slate-50 text-slate-600"
                onClick={() => navigate(`/parent/children/${id}/data`)}
              />
            </div>
          </section>

          {/* Contact Form */}
          <section className="bg-white border border-slate-100 rounded-[32px] p-8 space-y-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                 <MessageSquare className="w-5 h-5" />
              </div>
              تواصل مع الإدارة
            </h2>
            <form onSubmit={submitComment} className="space-y-4">
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                className="w-full h-32 rounded-2xl border border-slate-100 bg-slate-50/50 p-5 text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:bg-white focus:border-indigo-500/20 transition-all resize-none"
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
        </QueryStateHandler>
      </div>
    </AppLayout>
  );
}
