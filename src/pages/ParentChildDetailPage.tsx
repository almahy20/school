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
      className="group premium-card p-6 hover:translate-y-[-4px] transition-all duration-300 text-right w-full"
    >
      <div className="flex items-start justify-between mb-5">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500", color)}>
          <Icon className="w-6 h-6" />
        </div>
        {badge && (
          <Badge className="bg-slate-50 text-slate-500 border-none text-[9px] font-black uppercase tracking-widest">
            {badge}
          </Badge>
        )}
      </div>
      
      <h3 className="font-black text-slate-900 text-base mb-1">{title}</h3>
      {value && (
        <p className="text-2xl font-black text-slate-900 mb-1">{value}</p>
      )}
      {subtitle && (
        <p className="text-xs text-slate-400 font-medium">{subtitle}</p>
      )}
      
      <div className="mt-5 pt-4 border-t border-slate-50 flex items-center justify-between text-xs text-slate-300 group-hover:text-indigo-600 transition-colors">
        <span className="font-black uppercase tracking-widest">عرض التفاصيل</span>
        <ArrowRight className="w-4 h-4"/>
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
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/40 backdrop-blur-md p-6 md:p-8 rounded-[48px] border border-white/50 shadow-xl shadow-slate-200/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="flex items-center gap-4 md:gap-6 text-right relative z-10">
              <button
                onClick={() => navigate('/')}
                className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-white/80 text-slate-400 hover:text-slate-900 border border-slate-100 flex items-center justify-center transition-all active:scale-95 shadow-sm shrink-0"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3 md:gap-4">
                 <div className="w-12 h-12 md:w-14 md:h-14 rounded-[20px] bg-slate-900 flex items-center justify-center text-white text-xl font-black shadow-xl shadow-slate-200 shrink-0 rotate-3 group-hover:rotate-0 transition-all duration-500">
                    {child?.name?.[0]}
                 </div>
                 <div className="min-w-0">
                   <h1 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight leading-tight mb-1 truncate">{child?.name}</h1>
                   <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-indigo-50 border-indigo-100 text-indigo-600 font-black text-[9px] md:text-[10px] py-0.5">{child?.className || 'بدون فصل'}</Badge>
                      <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{child?.academic_year || '2025/2026'}</span>
                   </div>
                 </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 relative z-10">
              <div className="px-5 md:px-8 py-3.5 md:py-5 rounded-[24px] bg-white border border-slate-100 shadow-sm relative z-10 flex items-center gap-4 group hover:scale-[1.02] transition-all">
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
