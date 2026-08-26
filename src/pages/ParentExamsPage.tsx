import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import {
  ClipboardList, Clock, CheckCircle2, BookOpen,
  ChevronLeft, Timer, BarChart3,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import { useParentElectronicExams, type ElectronicExam, type ExamAttempt } from '@/hooks/queries/useElectronicExams';
import PageHeader from '@/components/layout/PageHeader';
import ExamTakingView from '@/components/exams/ExamTakingView';

type ExamWithStudent = ElectronicExam & {
  student_id: string;
  student_name: string;
  attempt?: ExamAttempt | null;
};

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ pct }: { pct: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#f43f5e';

  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={r} fill="none" stroke="#f1f5f9" strokeWidth="5" />
        <circle
          cx="26" cy="26" r={r} fill="none"
          stroke={color} strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[11px] font-black"
        style={{ color }}
      >
        {pct}%
      </span>
    </div>
  );
}

// ─── Meta Chip ────────────────────────────────────────────────────────────────

function MetaChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-slate-50 rounded-xl px-2.5 py-1.5">
      <span className="text-slate-400">{icon}</span>
      <span className="text-[10px] font-bold text-slate-600">{label}</span>
    </div>
  );
}

// ─── Exam Card ────────────────────────────────────────────────────────────────

function ExamCard({ exam, onStart }: { exam: ExamWithStudent; onStart: () => void }) {
  const isDone = !!exam.attempt;
  const pct = isDone && exam.attempt
    ? Math.round((exam.attempt.score / (exam.attempt.total_score || 1)) * 100)
    : null;

  return (
    <div className={cn(
      'group bg-white border rounded-[28px] p-5 transition-all duration-300 space-y-4',
      isDone
        ? 'border-emerald-100 hover:shadow-md hover:shadow-emerald-50'
        : 'border-slate-100 hover:border-violet-200 hover:shadow-md hover:shadow-violet-50/60',
    )}>
      {/* Top */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-black text-slate-900 text-sm leading-snug">{exam.title}</p>
          <p className="text-xs text-slate-400 font-bold mt-1">{exam.subject}</p>
        </div>
        <Badge className={cn(
          'text-[10px] font-black border-none rounded-xl px-2.5 py-1 shrink-0',
          isDone ? 'bg-emerald-50 text-emerald-600' : 'bg-violet-50 text-violet-600',
        )}>
          {isDone ? 'تم الحل' : 'متاح'}
        </Badge>
      </div>

      {/* Meta chips */}
      <div className="flex items-center flex-wrap gap-2">
        {exam.class_name && (
          <MetaChip icon={<BookOpen className="w-3 h-3" />} label={exam.class_name} />
        )}
        <MetaChip icon={<Clock className="w-3 h-3" />} label={`${exam.duration_minutes} دقيقة`} />
        {exam.student_name && (
          <MetaChip
            icon={
              <span className="w-3.5 h-3.5 rounded-full bg-violet-400 text-white flex items-center justify-center text-[7px] font-black">
                {exam.student_name[0]}
              </span>
            }
            label={exam.student_name}
          />
        )}
      </div>

      {/* Bottom: result or action */}
      {isDone && exam.attempt && pct !== null ? (
        <div className="flex items-center gap-4 bg-slate-50 rounded-[20px] p-3">
          <ScoreRing pct={pct} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-slate-900">
              {exam.attempt.score} <span className="text-slate-400 font-bold text-xs">من {exam.attempt.total_score}</span>
            </p>
            <p className={cn(
              'text-[11px] font-bold mt-0.5',
              pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-rose-600',
            )}>
              {pct >= 80 ? 'ممتاز 🌟' : pct >= 60 ? 'جيد 👍' : 'يحتاج مراجعة 📖'}
            </p>
            {exam.attempt.time_spent_seconds > 0 && (
              <div className="flex items-center gap-1 mt-1 text-slate-400">
                <Timer className="w-3 h-3" />
                <span className="text-[10px] font-bold">
                  {Math.floor(exam.attempt.time_spent_seconds / 60)}د{' '}
                  {exam.attempt.time_spent_seconds % 60 > 0 ? exam.attempt.time_spent_seconds % 60 + 'ث' : ''}
                </span>
              </div>
            )}
          </div>
          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
        </div>
      ) : (
        <button
          onClick={onStart}
          className="w-full h-11 rounded-[18px] bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white text-sm font-black transition-all flex items-center justify-center gap-2"
        >
          <ClipboardList className="w-4 h-4" />
          ابدأ الاختبار
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar({ exams }: { exams: ExamWithStudent[] }) {
  if (exams.length === 0) return null;
  const done    = exams.filter(e => !!e.attempt).length;
  const pending = exams.length - done;
  const avgPct  = done > 0
    ? Math.round(
        exams
          .filter(e => !!e.attempt)
          .reduce((sum, e) => sum + Math.round((e.attempt!.score / (e.attempt!.total_score || 1)) * 100), 0)
        / done,
      )
    : null;

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {[
        { label: 'الكل',    value: exams.length, color: 'text-slate-900', bg: 'bg-slate-50'   },
        { label: 'منتهي',   value: done,          color: 'text-emerald-700', bg: 'bg-emerald-50' },
        { label: 'معلّق',   value: pending,       color: 'text-violet-700',  bg: 'bg-violet-50'  },
      ].map(s => (
        <div key={s.label} className={cn('rounded-[20px] p-4 text-center border border-white/60', s.bg)}>
          <p className={cn('text-2xl font-black', s.color)}>{s.value}</p>
          <p className="text-[10px] font-bold text-slate-400 mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ParentExamsPage() {
  const { data: exams = [], isLoading, error, refetch } = useParentElectronicExams();
  const [activeExam, setActiveExam] = useState<ExamWithStudent | null>(null);

  if (activeExam) {
    return (
      <ExamTakingView
        exam={activeExam}
        studentId={activeExam.student_id}
        studentName={activeExam.student_name}
        onFinish={() => { setActiveExam(null); refetch(); }}
        onBack={() => setActiveExam(null)}
      />
    );
  }

  const typedExams = exams as ExamWithStudent[];
  const pending = typedExams.filter(e => !e.attempt);
  const done    = typedExams.filter(e => !!e.attempt);

  return (
    <AppLayout>
      <div className="max-w-[900px] mx-auto pb-20 px-4 md:px-0 animate-in fade-in duration-500" dir="rtl">
        <div className="pb-5">
          <PageHeader
            icon={ClipboardList}
            title="الاختبارات الإلكترونية"
            subtitle="اختبارات أبنائك"
          />
        </div>

        <QueryStateHandler
          loading={isLoading}
          error={error}
          data={exams}
          onRetry={refetch}
          loadingMessage="جاري تحميل الاختبارات..."
          emptyMessage="لا توجد اختبارات متاحة حالياً لأبنائك."
        >
          {/* Stats */}
          <StatsBar exams={typedExams} />

          {/* Pending exams */}
          {pending.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  اختبارات معلقة — {pending.length}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pending.map(exam => (
                  <ExamCard key={exam.id} exam={exam} onStart={() => setActiveExam(exam)} />
                ))}
              </div>
            </section>
          )}

          {/* Completed exams */}
          {done.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3 px-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  اختبارات منتهية — {done.length}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {done.map(exam => (
                  <ExamCard key={exam.id} exam={exam} onStart={() => setActiveExam(exam)} />
                ))}
              </div>
            </section>
          )}
        </QueryStateHandler>
      </div>
    </AppLayout>
  );
}
