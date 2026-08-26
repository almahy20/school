import { ArrowRight, Download, Users, BarChart3, Clock, Trophy, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useExamAttempts, type ElectronicExam } from '@/hooks/queries/useElectronicExams';
import { QueryStateHandler } from '@/components/QueryStateHandler';

interface ExamResultsViewProps {
  exam: ElectronicExam;
  classId: string;
  onBack: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}د ${s}ث`;
}

export default function ExamResultsView({ exam, classId, onBack }: ExamResultsViewProps) {
  const { data: attempts = [], isLoading, error, refetch } = useExamAttempts(exam.id);

  const avgScore = attempts.length
    ? Math.round(attempts.reduce((a, b) => a + Math.round((b.score / (b.total_score || 1)) * 100), 0) / attempts.length)
    : 0;

  const handleExportCSV = () => {
    if (!attempts.length) return;
    const header = ['اسم الطالب', 'الدرجة', 'الدرجة الكلية', 'النسبة المئوية', 'الوقت المستهلك'];
    const rows = attempts.map(a => [
      a.student_name || 'طالب',
      a.score,
      a.total_score,
      `${Math.round((a.score / (a.total_score || 1)) * 100)}%`,
      formatTime(a.time_spent_seconds),
    ]);
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `نتائج-${exam.title}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-black text-slate-400 hover:text-slate-900 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          الاختبارات
        </button>
        <span className="text-slate-200">/</span>
        <span className="text-sm font-black text-slate-900 truncate">{exam.title}</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard icon={<Users className="w-4 h-4" />} label="أتموا الاختبار" value={attempts.length} color="violet" />
        <SummaryCard icon={<BarChart3 className="w-4 h-4" />} label="متوسط الدرجات" value={`${avgScore}%`} color="emerald" />
        <SummaryCard icon={<Clock className="w-4 h-4" />} label="المدة الزمنية" value={`${exam.duration_minutes}د`} color="blue" />
        <SummaryCard icon={<Trophy className="w-4 h-4" />} label="عدد الأسئلة" value={exam.questions_count || 0} color="amber" />
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-100 rounded-[28px] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-black text-slate-900 text-sm">نتائج الطلاب</h3>
          <button
            onClick={handleExportCSV}
            disabled={!attempts.length}
            className="flex items-center gap-2 h-9 px-4 rounded-2xl bg-emerald-50 text-emerald-700 text-xs font-black hover:bg-emerald-100 disabled:opacity-40 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            تصدير CSV
          </button>
        </div>

        <QueryStateHandler
          loading={isLoading}
          error={error}
          data={attempts}
          onRetry={refetch}
          loadingMessage="جاري تحميل النتائج..."
          emptyMessage="لم يُكمل أي طالب الاختبار بعد."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">
                  <th className="px-6 py-3">اسم الطالب</th>
                  <th className="px-4 py-3 text-center">الدرجة</th>
                  <th className="px-4 py-3 text-center">الدرجة الكلية</th>
                  <th className="px-4 py-3 text-center">النسبة</th>
                  <th className="px-4 py-3 text-center">الوقت</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt, i) => {
                  const pct = Math.round((attempt.score / (attempt.total_score || 1)) * 100);
                  return (
                    <tr key={attempt.id} className={cn('border-t border-slate-50', i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30')}>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-slate-400" />
                          </div>
                          <span className="text-sm font-black text-slate-900">{attempt.student_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-black text-slate-900">{attempt.score}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-bold text-slate-500">{attempt.total_score}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn(
                          'px-2.5 py-1 rounded-xl text-xs font-black',
                          pct >= 80 ? 'bg-emerald-50 text-emerald-700'
                            : pct >= 60 ? 'bg-amber-50 text-amber-700'
                            : 'bg-rose-50 text-rose-700'
                        )}>
                          {pct}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs font-bold text-slate-500">{formatTime(attempt.time_spent_seconds)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </QueryStateHandler>
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string | number; color: string;
}) {
  const colors: Record<string, string> = {
    violet: 'bg-violet-50 text-violet-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="bg-white border border-slate-100 rounded-[24px] p-4 space-y-3">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', colors[color])}>
        {icon}
      </div>
      <div>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-xl font-black text-slate-900">{value}</p>
      </div>
    </div>
  );
}
