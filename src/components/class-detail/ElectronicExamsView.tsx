import { useState } from 'react';
import { ClipboardList, Plus, Eye, Trash2, Users, BarChart3, Clock, BookOpen, ChevronLeft, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useClassElectronicExams,
  useExamAttempts,
  useDeleteElectronicExam,
  type ElectronicExam,
} from '@/hooks/queries/useElectronicExams';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import CreateExamWizard from './CreateExamWizard';
import ExamResultsView from './ExamResultsView';

interface ElectronicExamsViewProps {
  classId: string;
  className: string;
}

type SubView = 'list' | 'create' | 'results';

export default function ElectronicExamsView({ classId, className }: ElectronicExamsViewProps) {
  const [subView, setSubView] = useState<SubView>('list');
  const [selectedExam, setSelectedExam] = useState<ElectronicExam | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ElectronicExam | null>(null);

  const { data: exams = [], isLoading, error, refetch } = useClassElectronicExams(classId);
  const deleteExam = useDeleteElectronicExam();

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteExam.mutateAsync({ id: deleteTarget.id, classId });
      toast.success('تم حذف الاختبار');
      setDeleteTarget(null);
    } catch (_) {}
  };

  if (subView === 'create') {
    return (
      <CreateExamWizard
        classId={classId}
        className={className}
        onBack={() => { setSubView('list'); refetch(); }}
        editExam={selectedExam}
      />
    );
  }

  if (subView === 'results' && selectedExam) {
    return (
      <ExamResultsView
        exam={selectedExam}
        classId={classId}
        onBack={() => { setSubView('list'); setSelectedExam(null); }}
        onEdit={() => { setSubView('create'); }}
      />
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-violet-50 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">الاختبارات الإلكترونية</h2>
            <p className="text-xs text-slate-400 font-bold">فصل {className}</p>
          </div>
        </div>
        <Button
          onClick={() => { setSelectedExam(null); setSubView('create'); }}
          className="h-10 px-5 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-sm gap-2"
        >
          <Plus className="w-4 h-4" />
          اختبار جديد
        </Button>
      </div>

      {/* List */}
      <QueryStateHandler
        loading={isLoading}
        error={error}
        data={exams}
        onRetry={refetch}
        loadingMessage="جاري تحميل الاختبارات..."
        emptyMessage="لا توجد اختبارات بعد. أنشئ أول اختبار إلكتروني."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {exams.map(exam => (
            <ExamCard
              key={exam.id}
              exam={exam}
              onViewResults={() => { setSelectedExam(exam); setSubView('results'); }}
              onEdit={() => { setSelectedExam(exam); setSubView('create'); }}
              onDelete={() => setDeleteTarget(exam)}
            />
          ))}
        </div>
      </QueryStateHandler>

      {/* Confirm delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl" className="rounded-[28px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black text-slate-900">حذف الاختبار</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 font-medium">
              هل أنت متأكد من حذف اختبار "{deleteTarget?.title}"؟ سيتم حذف جميع الأسئلة والنتائج المرتبطة به.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel className="rounded-2xl font-black">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteExam.isPending}
              className="rounded-2xl bg-rose-600 hover:bg-rose-700 font-black"
            >
              {deleteExam.isPending ? 'جاري الحذف...' : 'نعم، احذف'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Exam Card ────────────────────────────────────────────────────────────────

function ExamCard({
  exam,
  onViewResults,
  onEdit,
  onDelete,
}: {
  exam: ElectronicExam;
  onViewResults: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const statusConfig = {
    draft:     { label: 'مسودة',  color: 'bg-slate-100 text-slate-500' },
    published: { label: 'منشور', color: 'bg-emerald-50 text-emerald-600' },
    archived:  { label: 'مؤرشف', color: 'bg-amber-50 text-amber-600' },
  };
  const cfg = statusConfig[exam.status];

  return (
    <div className="group bg-white border border-slate-100 rounded-[28px] p-6 hover:shadow-md hover:shadow-violet-100/50 transition-all duration-300 space-y-4">
      {/* Top */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-black text-slate-900 text-sm leading-tight truncate">{exam.title}</p>
          <p className="text-xs text-slate-400 font-bold mt-1">{exam.subject}</p>
        </div>
        <Badge className={cn('text-[10px] font-black border-none rounded-lg px-2.5 py-1 shrink-0', cfg.color)}>
          {cfg.label}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatChip icon={<FileText className="w-3.5 h-3.5" />} label="سؤال" value={exam.questions_count ?? 0} />
        <StatChip icon={<Users className="w-3.5 h-3.5" />} label="محاولة" value={exam.attempts_count ?? 0} />
        <StatChip icon={<Clock className="w-3.5 h-3.5" />} label="دقيقة" value={exam.duration_minutes} />
      </div>

      {/* Average */}
      {(exam.attempts_count ?? 0) > 0 && (
        <div className="flex items-center gap-2 bg-violet-50 rounded-2xl px-3 py-2">
          <BarChart3 className="w-3.5 h-3.5 text-violet-500 shrink-0" />
          <span className="text-xs font-black text-violet-700">متوسط الدرجات: {exam.avg_score}%</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {exam.status === 'published' && (
          <button
            onClick={onViewResults}
            className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-2xl bg-violet-50 text-violet-700 text-xs font-black hover:bg-violet-100 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            النتائج
          </button>
        )}
        <button
          onClick={onEdit}
          className={cn(
            "flex items-center justify-center gap-1.5 h-9 rounded-2xl text-xs font-black transition-colors",
            exam.status === 'published'
              ? "px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700"
              : "flex-1 bg-slate-50 text-slate-700 hover:bg-slate-100"
          )}
          title="تعديل الاختبار والأسئلة"
        >
          <BookOpen className="w-3.5 h-3.5" />
          تعديل
        </button>
        <button
          onClick={onDelete}
          className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition-colors shrink-0"
          title="حذف الاختبار"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function StatChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-1 bg-slate-50 rounded-2xl py-2.5 px-2">
      <span className="text-slate-400">{icon}</span>
      <span className="text-sm font-black text-slate-900">{value}</span>
      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{label}</span>
    </div>
  );
}
