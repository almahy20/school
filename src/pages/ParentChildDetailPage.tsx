import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRight, Eye, BookOpen, Calendar, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
  const [child, setChild] = useState<any | null>(null);
  const [tab, setTab] = useState<'grades' | 'attendance' | 'financial'>('grades');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feePayments, setFeePayments] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    if (!id || !user) return;
    try {
      const { data: student, error: sErr } = await supabase
        .from('students')
        .select('*, classes!students_class_id_fkey(name)')
        .eq('id', id)
        .single();
      if (sErr) throw sErr;

      const [{ data: grades }, { data: attendance }, { data: fees }] = await Promise.all([
        supabase.from('grades').select('*').eq('school_id', user.schoolId).eq('student_id', id).order('date', { ascending: true }),
        supabase.from('attendance').select('*').eq('school_id', user.schoolId).eq('student_id', id).order('date', { ascending: false }),
        supabase.from('fees').select('*').eq('school_id', user.schoolId).eq('student_id', id),
      ]);

      const feeIds = (fees || []).map(f => f.id);
      let pData: any[] = [];
      if (feeIds.length > 0) {
        const { data: payments } = await supabase.from('fee_payments').select('*').eq('school_id', user.schoolId).in('fee_id', feeIds).order('payment_date', { ascending: false });
        pData = payments || [];
      }
      setFeePayments(pData);

      const presentCount = (attendance || []).filter(a => a.status === 'present').length;
      const avgGrade = (grades || []).length > 0
        ? Math.round((grades || []).reduce((sum, g) => sum + (g.score / g.max_score) * 100, 0) / (grades || []).length)
        : 0;
      const totalDue = (fees || []).reduce((sum: number, f: any) => sum + (f.amount_due || 0), 0);
      const totalPaid = (fees || []).reduce((sum: number, f: any) => sum + (f.amount_paid || 0), 0);

      setChild({
        ...student,
        className: (student as any).classes?.name || '',
        grades: grades || [],
        attendance: attendance || [],
        attendanceRate: (attendance || []).length > 0 ? Math.round((presentCount / (attendance || []).length) * 100) : 0,
        avgGrade,
        feesRemaining: Math.max(0, totalDue - totalPaid),
      });
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      navigate('/');
    }
  }, [id, user, navigate, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !user || !id) return;
    setSubmitting(true);
    const { error } = await supabase.from('complaints').insert({
      parent_id: user.id,
      student_id: id,
      content: comment.trim(),
      school_id: user.schoolId,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'تم إرسال التعليق' });
      setComment('');
    }
  };

  if (!child) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const gi = gradeInfo(child.avgGrade);
  const ai = gradeInfo(child.attendanceRate);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <header className="flex items-center gap-4 pb-6 border-b border-slate-100">
          <button
            onClick={() => navigate('/')}
            className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-900 border border-slate-100 flex items-center justify-center transition-all active:scale-95"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight leading-none mb-1">{child.name}</h1>
            <p className="text-xs font-medium text-slate-400">{child.className || 'بدون فصل'}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-10">
            <section className="bg-white border border-slate-100 rounded-3xl p-8 space-y-8 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`rounded-2xl p-5 text-center ${gi.bg} border border-slate-100`}>
                  <p className={`text-2xl font-bold ${gi.color}`}>{child.avgGrade > 0 ? `${child.avgGrade}%` : '—'}</p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">متوسط التحصيل</p>
                </div>
                <div className={`rounded-2xl p-5 text-center ${ai.bg} border border-slate-100`}>
                  <p className={`text-2xl font-bold ${ai.color}`}>{child.attendanceRate > 0 ? `${child.attendanceRate}%` : '—'}</p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">نسبة الحضور</p>
                </div>
              </div>
              {typeof child.feesRemaining === 'number' && (
                <div className="rounded-2xl p-5 text-center bg-slate-50 border border-slate-100">
                  <p className="text-2xl font-bold text-slate-900">{child.feesRemaining} ر.س</p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">المتبقي من المصروفات</p>
                </div>
              )}
            </section>

            <section className="bg-white border border-slate-100 rounded-3xl p-8 space-y-8 shadow-sm">
              <div className="flex px-0 border-b border-slate-100">
                {[
                  { id: 'grades', label: 'كشف الدرجات', icon: BookOpen },
                  { id: 'attendance', label: 'سجل الحضور', icon: Calendar },
                  { id: 'financial', label: 'السجل المالي', icon: Eye },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id as any)}
                    className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-all ${
                      tab === t.id ? 'border-primary text-primary' : 'border-transparent text-slate-400'
                    }`}
                  >
                    <t.icon className="w-4 h-4" />
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="space-y-6">
                {tab === 'grades' ? (
                  <GradesView grades={child.grades} />
                ) : tab === 'attendance' ? (
                  <AttendanceView attendance={child.attendance} />
                ) : (
                  <FinancialView payments={feePayments} />
                )}
              </div>
            </section>
          </div>

          <div className="space-y-10">
            <section className="bg-white border border-slate-100 rounded-3xl p-8 space-y-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                إضافة تعليق لمدير النظام
              </h2>
              <form onSubmit={submitComment} className="space-y-4">
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  className="w-full h-28 rounded-2xl border border-slate-100 bg-slate-50 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white focus:border-primary transition-all font-medium resize-none"
                  placeholder="اكتب تعليقك هنا حول الطالب ليطلع عليه المدير..."
                />
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 h-12 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:translate-y-[-2px] active:scale-95 transition-all"
                  >
                    {submitting ? 'جاري الإرسال...' : 'إرسال التعليق'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setComment('')}
                    className="flex-1 h-12 rounded-xl bg-slate-50 text-slate-500 font-bold hover:bg-slate-100 transition-all"
                  >
                    مسح
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
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
    return <div className="py-6 text-center"><p className="text-slate-400 font-bold">لا توجد درجات مسجلة</p></div>;
  return (
    <div className="space-y-6">
      {Object.entries(bySubject).map(([subject, subGrades]) => {
        const avg = Math.round(subGrades.reduce((s, g) => s + (g.score / g.max_score) * 100, 0) / subGrades.length);
        const gi = gradeInfo(avg);
        return (
          <div key={subject} className="rounded-2xl border border-slate-100 overflow-hidden">
            <div className={`px-5 py-3 flex items-center justify-between ${gi.bg}`}>
              <span className="font-bold text-slate-900">{subject}</span>
              <span className={`text-[11px] font-bold px-3 py-1 rounded-full bg-white/50 ${gi.color}`}>
                المتوسط {avg}%
              </span>
            </div>
            <div className="divide-y divide-slate-50">
              {subGrades.map((g: any, idx) => (
                <div key={g.id} className="px-5 py-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-700">{g.term || `اختبار ${idx + 1}`}</p>
                    <p className="text-[10px] text-slate-400">{new Date(g.date).toLocaleDateString('ar-EG')}</p>
                  </div>
                  <p className={`text-lg font-bold ${gradeInfo((g.score/g.max_score)*100).color}`}>{g.score}/{g.max_score}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AttendanceView({ attendance }: { attendance: any[] }) {
  if (attendance.length === 0)
    return <div className="py-6 text-center"><p className="text-slate-400 font-bold">لا يوجد سجل حضور</p></div>;
  return (
    <div className="grid grid-cols-5 gap-2">
      {attendance.map((a: any) => (
        <div
          key={a.id}
          title={`${a.date} - ${a.status}`}
          className={`h-12 rounded-xl flex flex-col items-center justify-center border ${
            a.status === 'present' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
            a.status === 'late' ? 'bg-amber-50 border-amber-100 text-amber-600' :
            'bg-rose-50 border-rose-100 text-rose-600'
          }`}
        >
          <span className="text-[10px] font-bold">{new Date(a.date).getDate()}</span>
          <span className="text-[8px] font-medium opacity-60">{new Date(a.date).toLocaleDateString('ar-EG', { month: 'short' })}</span>
        </div>
      ))}
    </div>
  );
}
function FinancialView({ payments }: { payments: any[] }) {
  if (payments.length === 0)
    return <div className="py-6 text-center"><p className="text-slate-400 font-bold">لا يوجد سجل مدفوعات</p></div>;
  return (
    <div className="space-y-4">
      {payments.map((p: any) => (
        <div key={p.id} className="p-4 rounded-2xl border border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-all">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Eye className="w-5 h-5" />
             </div>
             <div>
                <p className="text-sm font-bold text-slate-900">{p.amount.toLocaleString()} ر.س</p>
                <p className="text-[10px] text-slate-400">{p.payment_method} • {new Date(p.payment_date).toLocaleDateString('ar-EG')}</p>
             </div>
          </div>
          <Badge variant="outline" className="text-emerald-600 bg-emerald-50/50 border-emerald-100 font-black text-[9px]">مكتمل</Badge>
        </div>
      ))}
    </div>
  );
}
