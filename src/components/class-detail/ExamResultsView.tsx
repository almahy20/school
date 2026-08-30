import { Download, Users, BarChart3, Clock, Trophy, ChevronRight, Medal, Timer, ShieldAlert, ShieldOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useExamAttempts, type ElectronicExam, type ExamAttempt } from '@/hooks/queries/useElectronicExams';
import { QueryStateHandler } from '@/components/QueryStateHandler';

interface ExamResultsViewProps {
  exam: ElectronicExam;
  classId: string;
  onBack: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} ث`;
  return `${m}د ${s > 0 ? s + 'ث' : ''}`.trim();
}

function getScoreConfig(pct: number) {
  if (pct >= 80) return { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', bar: 'bg-emerald-400', label: 'ممتاز' };
  if (pct >= 60) return { bg: 'bg-amber-50',   text: 'text-amber-700',   ring: 'ring-amber-200',   bar: 'bg-amber-400',   label: 'جيد'    };
  return           { bg: 'bg-rose-50',   text: 'text-rose-700',   ring: 'ring-rose-200',   bar: 'bg-rose-400',   label: 'ضعيف'   };
}

function IntegrityBadge({ count }: { count: number }) {
  if (count <= 0) return null; // Do not show anything if the student did not commit any infractions
  if (count <= 2) return (
    <div className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-1 rounded-xl text-[10px] font-black" title={`تم رصد ${count} خروج من شاشة الاختبار`}>
      <ShieldAlert className="w-3 h-3" />
      <span>{count} مخالفة</span>
    </div>
  );
  return (
    <div className="flex items-center gap-1 bg-rose-50 text-rose-700 px-2 py-1 rounded-xl text-[10px] font-black border border-rose-200" title={`تم رصد ${count} محاولة مغادرة شاشة الاختبار — اشتباه بمحاولة غش`}>
      <ShieldOff className="w-3 h-3" />
      <span>اشتباه غش ({count})</span>
    </div>
  );
}

// ─── Student Result Card ──────────────────────────────────────────────────────

function StudentResultCard({ attempt, rank }: { attempt: ExamAttempt; rank: number }) {
  const pct = Math.round((attempt.score / (attempt.total_score || 1)) * 100);
  const cfg = getScoreConfig(pct);
  const tabCount = attempt.tab_switches_count ?? 0;

  const rankColors = ['bg-amber-400 text-white', 'bg-slate-300 text-white', 'bg-orange-400 text-white'];
  const rankColor = rank <= 3 ? rankColors[rank - 1] : 'bg-slate-100 text-slate-500';

  return (
    <div className={cn(
      'bg-white rounded-[24px] border p-5 space-y-4 transition-all duration-200 hover:shadow-md',
      rank === 1 ? 'border-amber-200 shadow-amber-50/80' : tabCount >= 3 ? 'border-rose-200' : 'border-slate-100',
    )}>
      {/* Top row: rank + name + score badge */}
      <div className="flex items-center gap-3">
        {/* Rank */}
        <div className={cn(
          'w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0',
          rankColor,
        )}>
          {rank <= 3 ? <Medal className="w-4 h-4" /> : rank}
        </div>

        {/* Avatar + name */}
        <div className="flex-1 min-w-0">
          <p className="font-black text-slate-900 text-sm truncate">
            {attempt.student_name || 'طالب'}
          </p>
          {rank <= 3 && (
            <p className="text-[10px] font-bold text-slate-400">
              {rank === 1 ? 'الأول' : rank === 2 ? 'الثاني' : 'الثالث'}
            </p>
          )}
        </div>

        {/* Score badge */}
        <div className={cn('px-3 py-1.5 rounded-2xl text-xs font-black ring-1', cfg.bg, cfg.text, cfg.ring)}>
          {attempt.score}/{attempt.total_score}
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', cfg.bar)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className={cn('text-xs font-black', cfg.text)}>{pct}% — {cfg.label}</span>
          <div className="flex items-center gap-1 text-slate-400">
            <Timer className="w-3 h-3" />
            <span className="text-[10px] font-bold">{formatTime(attempt.time_spent_seconds)}</span>
          </div>
        </div>
      </div>

      {/* Integrity Badge */}
      <IntegrityBadge count={tabCount} />
    </div>
  );
}

// ─── Summary Stat ─────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string | number; color: string;
}) {
  const colors: Record<string, string> = {
    violet: 'bg-violet-50 text-violet-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue:   'bg-blue-50 text-blue-600',
    amber:  'bg-amber-50 text-amber-600',
  };
  return (
    <div className="bg-white border border-slate-100 rounded-[20px] p-4 flex items-center gap-3">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', colors[color])}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
        <p className="text-lg font-black text-slate-900 leading-none">{value}</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ExamResultsView({ exam, classId, onBack }: ExamResultsViewProps) {
  const { data: attempts = [], isLoading, error, refetch } = useExamAttempts(exam.id);

  // Sort by score descending
  const sorted = [...attempts].sort((a, b) => {
    const pa = (a.score / (a.total_score || 1));
    const pb = (b.score / (b.total_score || 1));
    return pb - pa;
  });

  const avgScore = attempts.length
    ? Math.round(attempts.reduce((a, b) => a + Math.round((b.score / (b.total_score || 1)) * 100), 0) / attempts.length)
    : 0;

  const topScore = sorted[0]
    ? Math.round((sorted[0].score / (sorted[0].total_score || 1)) * 100)
    : 0;

  const handleExportCSV = () => {
    if (!attempts.length) return;
    const header = ['الترتيب', 'اسم الطالب', 'الدرجة', 'الدرجة الكلية', 'النسبة', 'الوقت'];
    const rows = sorted.map((a, i) => [
      i + 1,
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

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors shrink-0"
          aria-label="رجوع"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-black text-slate-900 text-base truncate">{exam.title}</h2>
          <p className="text-xs text-slate-400 font-bold mt-0.5">نتائج الطلاب</p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={!attempts.length}
          className="flex items-center gap-2 h-9 px-4 rounded-2xl bg-emerald-50 text-emerald-700 text-xs font-black hover:bg-emerald-100 disabled:opacity-40 transition-colors shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">تصدير CSV</span>
        </button>
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<Users className="w-4 h-4" />}    label="أتموا الاختبار" value={attempts.length}          color="violet" />
        <StatCard icon={<BarChart3 className="w-4 h-4" />} label="متوسط الدرجات"  value={`${avgScore}%`}           color="emerald" />
        <StatCard icon={<Trophy className="w-4 h-4" />}    label="أعلى درجة"      value={`${topScore}%`}           color="amber" />
        <StatCard icon={<Clock className="w-4 h-4" />}     label="مدة الاختبار"   value={`${exam.duration_minutes} د`} color="blue" />
      </div>

      {/* ── Results Cards ── */}
      <div className="bg-white border border-slate-100 rounded-[28px] overflow-hidden">
        {/* Card header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h3 className="font-black text-slate-900 text-sm">ترتيب الطلاب</h3>
          </div>
          {attempts.length > 0 && (
            <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2.5 py-1 rounded-xl">
              {attempts.length} طالب
            </span>
          )}
        </div>

        <QueryStateHandler
          loading={isLoading}
          error={error}
          data={attempts}
          onRetry={refetch}
          loadingMessage="جاري تحميل النتائج..."
          emptyMessage="لم يُكمل أي طالب الاختبار بعد."
        >
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {sorted.map((attempt, i) => (
              <StudentResultCard key={attempt.id} attempt={attempt} rank={i + 1} />
            ))}
          </div>
        </QueryStateHandler>
      </div>

    </div>
  );
}
