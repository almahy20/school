import { useState, useMemo } from 'react';
import { BookOpen, Layers, Plus, Edit3, Trash2, FolderOpen, Sparkles, ArrowRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import { useCurriculumSubjects, useDeleteSubject, useUpsertSubject } from '@/hooks/queries';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface ClassCurriculumViewProps {
  classItem: any;
  onAddCurriculum: () => void;
}

type CurriculumView = 'folders' | 'subjects';

export function ClassCurriculumView({ classItem, onAddCurriculum }: ClassCurriculumViewProps) {
  const { toast } = useToast();

  // ── Navigation ──
  const [view, setView] = useState<CurriculumView>('folders');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [localMonthFolders, setLocalMonthFolders] = useState<string[]>([]);

  // ── Dialogs ──
  const [showAddMonthDialog, setShowAddMonthDialog] = useState(false);
  const [showSubjectDialog, setShowSubjectDialog] = useState(false);
  const [editingSubject, setEditingSubject] = useState<any | null>(null);
  const [subjectName, setSubjectName] = useState('');
  const [subjectContent, setSubjectContent] = useState('');

  const {
    data: curriculumSubjects = [],
    isLoading: subjectsLoading,
    error: subjectsError,
    refetch: refetchSubjects
  } = useCurriculumSubjects(classItem?.curriculum_id || null);

  const upsertSubjectMutation = useUpsertSubject();
  const deleteSubjectMutation = useDeleteSubject();

  // Group by term (month)
  const curriculumByMonth = useMemo(() => {
    const groups: Record<string, any[]> = {};
    curriculumSubjects.forEach((sub: any) => {
      const key = (sub.term || 'عام').trim();
      if (!groups[key]) groups[key] = [];
      groups[key].push(sub);
    });
    return groups;
  }, [curriculumSubjects]);

  const allMonths = useMemo(() => {
    const fromDb = Object.keys(curriculumByMonth);
    const list = Array.from(new Set([...fromDb, ...localMonthFolders]));
    return list;
  }, [curriculumByMonth, localMonthFolders]);

  const activeSubjects = useMemo(() =>
    selectedMonth ? curriculumByMonth[selectedMonth] || [] : [],
    [selectedMonth, curriculumByMonth]
  );

  // ── Handlers ──
  const handleDeleteSubject = async (subjectId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه المادة؟')) return;
    if (!classItem?.curriculum_id) return;
    try {
      await deleteSubjectMutation.mutateAsync({ id: subjectId, curriculumId: classItem.curriculum_id });
      toast({ title: 'تم حذف المادة بنجاح' });
      refetchSubjects();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleSubjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classItem?.curriculum_id || !subjectName.trim()) return;
    try {
      await upsertSubjectMutation.mutateAsync({
        id: editingSubject?.id,
        curriculum_id: classItem.curriculum_id,
        subject_name: subjectName.trim(),
        content: subjectContent.trim() || null,
        term: selectedMonth || 'عام',
      });
      toast({ title: editingSubject ? 'تم تحديث المادة 🌟' : 'تم إضافة المادة 🌟' });
      setShowSubjectDialog(false);
      setEditingSubject(null);
      setSubjectName('');
      setSubjectContent('');
      refetchSubjects();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const openAddSubject = () => {
    setEditingSubject(null);
    setSubjectName('');
    setSubjectContent('');
    setShowSubjectDialog(true);
  };

  const openEditSubject = (subject: any) => {
    setEditingSubject(subject);
    setSubjectName(subject.subject_name);
    setSubjectContent(subject.content || '');
    setShowSubjectDialog(true);
  };

  const handleAddMonthSubmit = (title: string) => {
    const clean = title.trim();
    if (!clean) return;
    if (!allMonths.includes(clean)) {
      setLocalMonthFolders(prev => [...prev, clean]);
    }
    setSelectedMonth(clean);
    setView('subjects');
    setShowAddMonthDialog(false);
    toast({ title: 'تم إنشاء كارت المنهج الشهري' });
  };

  const enterFolder = (month: string) => {
    setSelectedMonth(month);
    setView('subjects');
  };

  // ══════════════════════════════════════════════════════════════
  // VIEW: Folder Cards Grid
  // ══════════════════════════════════════════════════════════════
  if (!classItem?.curriculum_id) {
    return (
      <section className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm text-right space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">إدارة المنهج الدراسي</h2>
              <p className="text-xs text-slate-400 font-bold mt-0.5">يرجى ربط منهج دراسي للفصل للبدء</p>
            </div>
          </div>
          <Button onClick={onAddCurriculum} className="h-11 px-5 rounded-xl bg-slate-900 text-white font-black text-xs gap-2">
            <Layers className="w-4 h-4" />
            ربط منهج
          </Button>
        </div>
        <div className="py-16 text-center bg-slate-50 border border-dashed border-slate-200 rounded-[32px] space-y-3 text-slate-400">
          <Sparkles className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold text-sm">اربط منهجاً دراسياً بالفصل للبدء في تقسيم المقررات الشهرية.</p>
        </div>
      </section>
    );
  }

  if (view === 'folders') {
    return (
      <section className="space-y-5 text-right animate-in fade-in duration-400" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 bg-white px-6 py-5 rounded-[28px] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">إدارة المنهج الدراسي</h2>
              <p className="text-[11px] text-slate-400 font-bold mt-0.5">{allMonths.length} كرت منهجي شهري</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowAddMonthDialog(true)}
              className="h-11 px-5 rounded-xl bg-slate-900 text-white font-black text-xs gap-2"
            >
              <Plus className="w-4 h-4" />
              إنشاء كارت شهر
            </Button>
            <Button
              onClick={onAddCurriculum}
              variant="outline"
              className="h-11 px-4 rounded-xl border-slate-200 text-slate-500 font-black text-xs gap-2"
            >
              <Layers className="w-3.5 h-3.5" />
              تغيير المنهج
            </Button>
          </div>
        </div>

        {/* Month Cards Grid */}
        <QueryStateHandler
          loading={subjectsLoading}
          error={subjectsError}
          data={curriculumSubjects}
          onRetry={refetchSubjects}
          loadingMessage="جاري تحميل المنهج..."
          isEmpty={allMonths.length === 0}
          emptyMessage="لا توجد كروت منهج بعد. اضغط على 'إنشاء كارت شهر' للبدء."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {allMonths.map(month => {
              const subjects = curriculumByMonth[month] || [];
              return (
                <button
                  key={month}
                  onClick={() => enterFolder(month)}
                  className="group text-right p-6 rounded-[28px] border border-slate-100 bg-white hover:border-purple-200 hover:shadow-xl hover:shadow-purple-50/60 transition-all duration-300 active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="w-13 h-13 w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center group-hover:bg-purple-100 transition-colors shrink-0">
                      <FolderOpen className="w-6 h-6" />
                    </div>
                    <ChevronLeft className="w-5 h-5 text-slate-300 group-hover:text-purple-500 transition-colors mt-1 shrink-0" />
                  </div>
                  <h3 className="font-black text-slate-900 text-base mb-1.5">📖 {month}</h3>
                  <p className="text-[11px] text-slate-400 font-bold mb-4">{subjects.length} مادة مقررة</p>
                  <div className="flex flex-wrap gap-1.5">
                    {subjects.slice(0, 4).map((s: any) => (
                      <span key={s.id} className="text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-100 px-2.5 py-1 rounded-lg">
                        {s.subject_name}
                      </span>
                    ))}
                    {subjects.length > 4 && (
                      <span className="text-[10px] font-bold bg-purple-50 text-purple-500 px-2 py-1 rounded-lg">+{subjects.length - 4}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </QueryStateHandler>

        {showAddMonthDialog && (
          <AddMonthDialog onClose={() => setShowAddMonthDialog(false)} onSubmit={handleAddMonthSubmit} />
        )}
      </section>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // VIEW: Inside a Month Folder — Subjects full-width
  // ══════════════════════════════════════════════════════════════
  return (
    <section className="space-y-5 text-right animate-in fade-in slide-in-from-right-4 duration-400" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setView('folders')}
          className="flex items-center gap-2 text-sm font-black text-slate-400 hover:text-slate-900 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          كروت المنهج
        </button>
        <span className="text-slate-200">/</span>
        <span className="text-sm font-black text-slate-900">{selectedMonth}</span>
      </div>

      {/* Subject list panel */}
      <div className="bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-sm">
        {/* Panel header */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-5 h-5 text-purple-600" />
            <div>
              <h3 className="text-base font-black text-slate-900">مقررات {selectedMonth}</h3>
              <p className="text-[11px] text-slate-400 font-bold mt-0.5">{activeSubjects.length} مادة دراسية مضافة</p>
            </div>
          </div>
          <Button
            onClick={openAddSubject}
            className="h-11 px-5 rounded-xl bg-slate-900 text-white font-black text-xs gap-2 shadow-md"
          >
            <Plus className="w-4 h-4" />
            إضافة مادة
          </Button>
        </div>

        <QueryStateHandler
          loading={subjectsLoading}
          error={subjectsError}
          data={curriculumSubjects}
          onRetry={refetchSubjects}
          loadingMessage="جاري تحميل المواد..."
          isEmpty={activeSubjects.length === 0}
          emptyMessage={`لا توجد مواد مضافة بعد لـ (${selectedMonth}). اضغط "إضافة مادة" للبدء.`}
        >
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeSubjects.map((sub: any) => (
              <div
                key={sub.id}
                className="group p-5 rounded-[24px] border border-slate-100 bg-slate-50/40 hover:border-purple-100 hover:bg-white hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-slate-900 text-sm truncate">{sub.subject_name}</h4>
                      <p className="text-xs text-slate-500 leading-relaxed font-medium mt-1.5 line-clamp-2">
                        {sub.content || 'لم يتم كتابة تفاصيل المقرر بعد.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => openEditSubject(sub)}
                      className="w-8 h-8 rounded-lg bg-white text-slate-400 hover:text-purple-600 hover:bg-purple-50 border border-slate-100 transition-all flex items-center justify-center"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteSubject(sub.id)}
                      className="w-8 h-8 rounded-lg bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 border border-slate-100 transition-all flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </QueryStateHandler>
      </div>

      {/* Dialogs */}
      {showSubjectDialog && (
        <SubjectDialog
          editingSubject={editingSubject}
          subjectName={subjectName}
          setSubjectName={setSubjectName}
          subjectContent={subjectContent}
          setSubjectContent={setSubjectContent}
          isSaving={upsertSubjectMutation.isPending}
          onClose={() => setShowSubjectDialog(false)}
          onSubmit={handleSubjectSubmit}
        />
      )}
    </section>
  );
}

// ─── Add Month Dialog ──────────────────────────────────────────────────────────
function AddMonthDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (t: string) => void }) {
  const [monthTitle, setMonthTitle] = useState('منهج شهر 7');
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-right" onClick={onClose} dir="rtl">
      <div className="bg-white border border-slate-100 shadow-2xl w-full max-w-md p-8 rounded-[40px] animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6 border-b border-slate-50 pb-5">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
            <Plus className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">إنشاء كارت منهج شهري</h2>
            <p className="text-xs text-slate-400 font-bold mt-0.5">تقسيم المناهج بحسب الأشهر</p>
          </div>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSubmit(monthTitle); }} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700">عنوان الشهر المنهجي *</label>
            <Input
              value={monthTitle}
              onChange={e => setMonthTitle(e.target.value)}
              className="h-12 px-5 rounded-xl border-slate-200 bg-slate-50 focus:bg-white font-bold text-sm"
              placeholder="مثال: منهج شهر 7"
              required
            />
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="submit" className="flex-1 h-12 rounded-xl bg-slate-900 hover:bg-purple-700 text-white font-black shadow-lg text-sm">
              إنشاء الكارت
            </Button>
            <Button type="button" onClick={onClose} variant="ghost" className="h-12 px-6 rounded-xl bg-slate-100 text-slate-600 font-black text-sm">
              إلغاء
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Subject Add/Edit Dialog ───────────────────────────────────────────────────
function SubjectDialog({
  editingSubject, subjectName, setSubjectName,
  subjectContent, setSubjectContent, isSaving, onClose, onSubmit
}: {
  editingSubject: any | null;
  subjectName: string; setSubjectName: (v: string) => void;
  subjectContent: string; setSubjectContent: (v: string) => void;
  isSaving: boolean; onClose: () => void; onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-right" onClick={onClose} dir="rtl">
      <div className="bg-white border border-slate-100 shadow-2xl w-full max-w-lg p-8 rounded-[40px] animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6 border-b border-slate-50 pb-5">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">
              {editingSubject ? 'تعديل المادة الدراسية' : 'إضافة مادة دراسية'}
            </h2>
            <p className="text-xs text-slate-400 font-bold mt-0.5">تحديد المادة والمقرر لهذا الشهر</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700">اسم المادة *</label>
            <Input
              value={subjectName}
              onChange={e => setSubjectName(e.target.value)}
              placeholder="مثال: لغتي الجميلة، الرياضيات"
              className="h-12 px-5 rounded-xl border-slate-200 bg-slate-50 focus:bg-white font-bold text-sm"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700">تفاصيل المقرر والمحتوى</label>
            <Textarea
              value={subjectContent}
              onChange={e => setSubjectContent(e.target.value)}
              placeholder="مثال: الوحدة الأولى: دروس النحو الأساسية..."
              className="min-h-[130px] px-5 py-4 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm font-bold resize-none"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <Button
              type="submit"
              disabled={isSaving}
              className="flex-1 h-12 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black shadow-lg text-sm"
            >
              {isSaving ? 'جاري الحفظ...' : editingSubject ? 'حفظ التعديلات' : 'إضافة المادة'}
            </Button>
            <Button type="button" onClick={onClose} variant="ghost" className="h-12 px-6 rounded-xl bg-slate-100 text-slate-600 font-black text-sm">
              إلغاء
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
