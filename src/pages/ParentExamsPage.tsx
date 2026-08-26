import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { ClipboardList, Clock, CheckCircle2, BookOpen, Loader2 } from 'lucide-react';
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

  return (
    <AppLayout>
      <div className="max-w-[900px] mx-auto pb-20 px-4 md:px-0 animate-in fade-in duration-500" dir="rtl">
        <div className="pb-4">
          <PageHeader
            icon={ClipboardList}
            title="الاختبارات الإلكترونية"
            subtitle="اختبارات أبنائك المتاحة"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(exams as ExamWithStudent[]).map(exam => (
              <ExamCard
                key={exam.id}
                exam={exam}
                onStart={() => setActiveExam(exam)}
              />
            ))}
          </div>
        </QueryStateHandler>
      </div>
    </AppLayout>
  );
}

// ─── Exam Card ────────────────────────────────────────────────────────────────

function ExamCard({ exam, onStart }: { exam: ExamWithStudent; onStart: () => void }) {
  const isDone = !!exam.attempt;

  return (
    <div className="group bg-white border border-slate-100 rounded-[28px] p-6 hover:shadow-md hover:shadow-violet-100/50 transition-all duration-300 space-y-4">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-black text-slate-900 text-sm leading-tight">{exam.title}</p>
          <p className="text-xs text-slate-400 font-bold mt-1">{exam.subject}</p>
        </div>
        <Badge className={cn(
          'text-[10px] font-black border-none rounded-lg px-2.5 py-1 shrink-0',
          isDone ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
        )}>
          {isDone ? 'تم الحل' : 'جديد'}
        </Badge>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 flex-wrap">
        <MetaChip icon={<BookOpen className="w-3 h-3" />} label={exam.class_name || ''} />
        <MetaChip icon={<Clock className="w-3 h-3" />} label={`${exam.duration_minutes} دقيقة`} />
        {exam.student_name && (
          <MetaChip icon={<span className="w-3 h-3 rounded-full bg-violet-400 text-white flex items-center justify-center text-[7px] font-black">{exam.student_name[0]}</span>} label={exam.student_name} />
        )}
      </div>

      {/* Bottom action */}
      {isDone && exam.attempt ? (
        <div className="flex items-center gap-3 bg-emerald-50 rounded-2xl px-4 py-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <div>
            <p className="text-sm font-black text-emerald-800">
              {exam.attempt.score} / {exam.attempt.total_score}
            </p>
            <p className="text-[10px] font-bold text-emerald-600">
              {Math.round((exam.attempt.score / (exam.attempt.total_score || 1)) * 100)}% نسبة النجاح
            </p>
          </div>
        </div>
      ) : (
        <button
          onClick={onStart}
          className="w-full h-11 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-black transition-colors flex items-center justify-center gap-2"
        >
          <ClipboardList className="w-4 h-4" />
          ابدأ الاختبار
        </button>
      )}
    </div>
  );
}

function MetaChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-slate-50 rounded-xl px-2.5 py-1.5">
      <span className="text-slate-400">{icon}</span>
      <span className="text-[10px] font-bold text-slate-600">{label}</span>
    </div>
  );
}
