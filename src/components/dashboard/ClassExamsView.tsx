import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { 
  BookOpen, Plus, Trash2, Save, FolderOpen, Sparkles, Search, ArrowRight, ChevronLeft, Copy, CheckCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  useExamTemplates,
  useStudentGrades,
  useCreateExamTemplate,
  useDeleteExamTemplate,
  useUpsertGrades,
  useAllClasses
} from '@/hooks/queries';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface ClassExamsViewProps {
  classId: string;
  className: string;
}

type ViewState = 'folders' | 'grading';

export default function ClassExamsView({ classId, className }: ClassExamsViewProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  const [view, setView] = useState<ViewState>('folders');
  const [selectedFolderName, setSelectedFolderName] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddSubjectDialog, setShowAddSubjectDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedStudentId, setCopiedStudentId] = useState<string | null>(null);

  const { 
    data: templatesData, 
    isLoading: templatesLoading, 
    error: templatesError,
    refetch: refetchTemplates 
  } = useExamTemplates(classId, null, 1, 100);

  const templates = templatesData?.data || [];

  // Group by title (monthly card name)
  const monthFolders = useMemo(() => {
    const folders: Record<string, any[]> = {};
    templates.forEach(t => {
      const key = (t.title || t.term || 'تقييم شهري').trim();
      if (!folders[key]) folders[key] = [];
      folders[key].push(t);
    });
    return folders;
  }, [templates]);

  const monthFolderKeys = Object.keys(monthFolders);

  const { 
    data: studentGradesData,
    isLoading: gradesLoading,
    error: gradesError,
    refetch: refetchGrades
  } = useStudentGrades(selectedTemplate || null, classId);

  const studentGrades = useMemo(() => studentGradesData || [], [studentGradesData]);
  const [localGrades, setLocalGrades] = useState(studentGrades);

  useEffect(() => { setLocalGrades(studentGrades); }, [studentGrades]);

  const handleGradeChange = (studentId: string, score: string) => {
    setLocalGrades(prev => prev.map(g => g.studentId === studentId ? { ...g, score } : g));
  };

  // Copy one student's score to clipboard feedback
  const handleCopyToOthers = (sourceStudentId: string) => {
    const source = localGrades.find(g => g.studentId === sourceStudentId);
    if (!source?.score?.trim()) return;
    setLocalGrades(prev => prev.map(g =>
      g.studentId !== sourceStudentId ? { ...g, score: source.score } : g
    ));
    setCopiedStudentId(sourceStudentId);
    setTimeout(() => setCopiedStudentId(null), 1500);
    toast({ title: `تم نسخ "${source.score}" لجميع الطلاب` });
  };

  const filteredGrades = localGrades.filter(sg =>
    (sg.studentName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const createExamMutation = useCreateExamTemplate();
  const deleteExamMutation = useDeleteExamTemplate();
  const upsertGradesMutation = useUpsertGrades();

  const handleSaveGrades = async () => {
    if (!selectedTemplate) return;
    const gradesToSave = localGrades
      .filter(g => g.score.trim() !== '')
      .map(g => ({
        student_id: g.studentId,
        exam_template_id: selectedTemplate.id,
        score: g.score,
        max_score: selectedTemplate.max_score || 100,
        subject: selectedTemplate.subject || '',
        term: selectedTemplate.term || '',
        date: new Date().toISOString(),
      }));
    if (gradesToSave.length === 0) return;
    try {
      await upsertGradesMutation.mutateAsync(gradesToSave);
      toast({ title: 'تم حفظ التقييمات بنجاح 🌟' });
      refetchGrades();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteExam = async (templateId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا التقييم نهائياً؟')) return;
    try {
      await deleteExamMutation.mutateAsync(templateId);
      toast({ title: 'تم الحذف بنجاح' });
      setView('folders');
      setSelectedTemplate(null);
      refetchTemplates();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const enterFolder = (folderName: string) => {
    setSelectedFolderName(folderName);
    const folderTemplates = monthFolders[folderName] || [];
    setSelectedTemplate(folderTemplates[0] || null);
    setView('grading');
  };

  // ─────────────────────────────────────────────────────────────
  // VIEW: Month Cards Grid
  // ─────────────────────────────────────────────────────────────
  if (view === 'folders') {
    return (
      <div className="space-y-5 animate-in fade-in duration-400 text-right" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white px-6 py-5 rounded-[28px] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">سجل التقييمات الشهرية</h2>
              <p className="text-[11px] text-slate-400 font-bold mt-0.5">{className} • {monthFolderKeys.length} كرت تقييم</p>
            </div>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="h-11 px-5 rounded-xl bg-slate-900 hover:bg-indigo-700 text-white font-black text-xs shadow-md gap-2"
          >
            <Plus className="w-4 h-4" />
            إنشاء كارت تقييم شهري
          </Button>
        </div>

        <QueryStateHandler
          loading={templatesLoading}
          error={templatesError}
          data={templates}
          onRetry={refetchTemplates}
          loadingMessage="جاري تحميل كروت التقييم..."
          isEmpty={templates.length === 0}
          emptyMessage="لا توجد كروت تقييم بعد. اضغط على 'إنشاء كارت تقييم شهري' للبدء."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {monthFolderKeys.map(folderName => {
              const folderTemplates = monthFolders[folderName] || [];
              return (
                <button
                  key={folderName}
                  onClick={() => enterFolder(folderName)}
                  className="group text-right p-6 rounded-[28px] border border-slate-100 bg-white hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-50/60 transition-all duration-300 active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between gap-3 mb-5">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center group-hover:bg-indigo-100 transition-colors shrink-0">
                      <FolderOpen className="w-7 h-7" />
                    </div>
                    <ChevronLeft className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors mt-1 shrink-0" />
                  </div>
                  <h3 className="font-black text-slate-900 text-base mb-2">📁 {folderName}</h3>
                  <p className="text-[11px] text-slate-400 font-bold mb-4">{folderTemplates.length} مواد دراسية</p>
                  <div className="flex flex-wrap gap-1.5">
                    {folderTemplates.slice(0, 4).map(t => (
                      <span key={t.id} className="text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-100 px-2.5 py-1 rounded-lg">
                        {t.subject}
                      </span>
                    ))}
                    {folderTemplates.length > 4 && (
                      <span className="text-[10px] font-bold bg-indigo-50 text-indigo-500 px-2 py-1 rounded-lg">+{folderTemplates.length - 4}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </QueryStateHandler>

        {showCreateDialog && (
          <CreateMonthCardDialog
            classId={classId}
            className={className}
            onClose={() => setShowCreateDialog(false)}
            onSuccess={(folderName) => {
              setShowCreateDialog(false);
              refetchTemplates();
              // Enter the new folder immediately
              setTimeout(() => {
                setSelectedFolderName(folderName);
                setSelectedTemplate(null);
                setView('grading');
              }, 300);
            }}
          />
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // VIEW: Inside a Month — Grading Full Width
  // ─────────────────────────────────────────────────────────────
  const currentFolderTemplates = monthFolders[selectedFolderName] || [];

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-400 text-right" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView('folders')}
            className="flex items-center gap-2 text-sm font-black text-slate-400 hover:text-slate-900 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            كروت التقييم
          </button>
          <span className="text-slate-200">/</span>
          <span className="text-sm font-black text-slate-900">{selectedFolderName}</span>
        </div>
        <Button
          onClick={() => setShowAddSubjectDialog(true)}
          className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-2 shadow-md"
        >
          <Plus className="w-3.5 h-3.5" />
          إضافة مادة
        </Button>
      </div>

      {/* Subject tabs */}
      <div className="bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-center gap-3 overflow-x-auto hide-scrollbar">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">المواد:</span>
          {currentFolderTemplates.length === 0 ? (
            <span className="text-xs text-slate-400 font-bold">لا توجد مواد بعد — اضغط "إضافة مادة" لإضافة أول مادة</span>
          ) : (
            <div className="flex items-center gap-2">
              {currentFolderTemplates.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplate(t)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0',
                    selectedTemplate?.id === t.id
                      ? 'bg-slate-900 text-white shadow-lg'
                      : 'bg-white text-slate-500 border border-slate-100 hover:border-slate-200 hover:text-slate-800'
                  )}
                >
                  {t.subject}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedTemplate ? (
          <>
            {/* Grade entry header */}
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  {selectedTemplate.subject}
                </h3>
                <p className="text-xs text-slate-400 font-bold mt-1">
                  {selectedTemplate.score_type === 'text'
                    ? '📝 تقييم وصفي / مهارات'
                    : `🔢 درجات رقمية (من ${selectedTemplate.max_score})`}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-wrap justify-end">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-300 absolute right-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="بحث..."
                    className="pr-9 h-10 bg-slate-50 border-slate-200 text-xs font-bold rounded-xl w-36"
                  />
                </div>
                <button
                  onClick={() => handleDeleteExam(selectedTemplate.id)}
                  className="w-10 h-10 rounded-xl bg-rose-50 text-rose-400 hover:bg-rose-100 flex items-center justify-center transition-all shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <Button
                  onClick={handleSaveGrades}
                  disabled={upsertGradesMutation.isPending}
                  className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md gap-2"
                >
                  <Save className="w-4 h-4" />
                  حفظ الدرجات
                </Button>
              </div>
            </div>

            {/* Grade rows */}
            <QueryStateHandler
              loading={gradesLoading}
              error={gradesError}
              data={studentGrades}
              onRetry={refetchGrades}
              loadingMessage="جاري تحميل قائمة الطلاب..."
            >
              <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto">
                {filteredGrades.map((grade, idx) => (
                  <div key={grade.studentId} className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 text-xs font-black flex items-center justify-center shrink-0">
                        {idx + 1}
                      </div>
                      <span className="font-black text-slate-800 text-sm">{grade.studentName}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedTemplate.score_type === 'text' ? (
                        <>
                          <Input
                            value={grade.score}
                            onChange={e => handleGradeChange(grade.studentId, e.target.value)}
                            placeholder="ممتاز، جيد جداً، يحتاج دعم..."
                            className="h-10 w-48 text-xs font-bold rounded-xl text-right bg-slate-50 border-slate-200 focus:bg-white"
                          />
                          {/* Copy to all button */}
                          {grade.score.trim() && (
                            <button
                              onClick={() => handleCopyToOthers(grade.studentId)}
                              title="نسخ هذا التقييم لجميع الطلاب"
                              className={cn(
                                'w-9 h-9 rounded-xl border flex items-center justify-center transition-all shrink-0',
                                copiedStudentId === grade.studentId
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                                  : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600'
                              )}
                            >
                              {copiedStudentId === grade.studentId
                                ? <CheckCheck className="w-3.5 h-3.5" />
                                : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={grade.score}
                            onChange={e => handleGradeChange(grade.studentId, e.target.value)}
                            placeholder="0"
                            className="h-10 w-20 text-center font-black text-sm rounded-xl bg-slate-50 border-slate-200 focus:bg-white"
                          />
                          <span className="text-xs font-bold text-slate-300">/ {selectedTemplate.max_score}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </QueryStateHandler>
          </>
        ) : (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <Sparkles className="w-10 h-10 mx-auto text-slate-200" />
            <p className="font-bold text-sm">اضغط "إضافة مادة" لإضافة أول مادة دراسية لهذا الكارت الشهري</p>
          </div>
        )}
      </div>

      {showAddSubjectDialog && (
        <AddSubjectDialog
          classId={classId}
          folderName={selectedFolderName}
          onClose={() => setShowAddSubjectDialog(false)}
          onSuccess={() => {
            setShowAddSubjectDialog(false);
            refetchTemplates();
          }}
        />
      )}
    </div>
  );
}

// ─── Create Month Card Dialog (NO auto-generation) ────────────────────────────
function CreateMonthCardDialog({
  classId,
  className,
  onClose,
  onSuccess
}: {
  classId: string;
  className: string;
  onClose: () => void;
  onSuccess: (folderName: string) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [monthTitle, setMonthTitle] = useState('تقييم شهر 7');
  const [scoreType, setScoreType] = useState<'numeric' | 'text'>('text');
  const [maxScore, setMaxScore] = useState('100');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createMutation = useCreateExamTemplate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!monthTitle.trim()) return;
    setIsSubmitting(true);
    try {
      // Create a single placeholder template to establish the folder
      await createMutation.mutateAsync({
        class_id: classId,
        subject: 'مادة جديدة',
        exam_type: 'monthly',
        max_score: Number(maxScore) || 100,
        weight: 1,
        term: monthTitle.trim(),
        title: monthTitle.trim(),
        score_type: scoreType,
        teacher_id: user?.id || ''
      });
      toast({ title: 'تم إنشاء كارت التقييم الشهري 🌟', description: 'يمكنك الآن إضافة المواد يدوياً' });
      onSuccess(monthTitle.trim());
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-right" onClick={onClose} dir="rtl">
      <div className="bg-white border border-slate-100 shadow-2xl w-full max-w-md p-8 rounded-[40px] animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6 border-b border-slate-50 pb-5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">إنشاء كارت تقييم شهري</h2>
            <p className="text-xs text-slate-400 font-bold mt-0.5">فصل: {className}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700">عنوان الكارت الشهري *</label>
            <Input
              value={monthTitle}
              onChange={e => setMonthTitle(e.target.value)}
              className="h-12 px-5 rounded-xl border-slate-200 bg-slate-50 focus:bg-white font-bold text-sm"
              placeholder="مثال: تقييم شهر 7"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700">نوع التقييم الافتراضي</label>
            <div className="grid grid-cols-2 gap-3">
              {[{ val: 'text', label: '📝 وصفي / مهارات' }, { val: 'numeric', label: '🔢 درجات رقمية' }].map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setScoreType(opt.val as any)}
                  className={cn(
                    'h-12 rounded-xl border flex items-center justify-center font-black text-xs transition-all',
                    scoreType === opt.val
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {scoreType === 'numeric' && (
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700">الدرجة النهائية</label>
              <Input
                type="number"
                value={maxScore}
                onChange={e => setMaxScore(e.target.value)}
                className="h-12 px-5 rounded-xl border-slate-200 bg-slate-50 font-black text-center text-sm"
              />
            </div>
          )}

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <p className="text-xs font-bold text-slate-500">
              💡 بعد الإنشاء ستدخل مباشرة للكارت وتضيف المواد يدوياً بضغطة "إضافة مادة"
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="submit" disabled={isSubmitting} className="flex-1 h-12 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white font-black shadow-lg text-sm">
              {isSubmitting ? 'جاري الإنشاء...' : 'إنشاء الكارت'}
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

// ─── Add Subject Dialog (inside a folder) ────────────────────────────────────
function AddSubjectDialog({
  classId,
  folderName,
  onClose,
  onSuccess
}: {
  classId: string;
  folderName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subjectName, setSubjectName] = useState('');
  const [scoreType, setScoreType] = useState<'numeric' | 'text'>('text');
  const [maxScore, setMaxScore] = useState('100');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createMutation = useCreateExamTemplate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim()) return;
    setIsSubmitting(true);
    try {
      await createMutation.mutateAsync({
        class_id: classId,
        subject: subjectName.trim(),
        exam_type: 'monthly',
        max_score: Number(maxScore) || 100,
        weight: 1,
        term: folderName,
        title: folderName,
        score_type: scoreType,
        teacher_id: user?.id || ''
      });
      toast({ title: `تم إضافة مادة "${subjectName}" بنجاح` });
      onSuccess();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-right" onClick={onClose} dir="rtl">
      <div className="bg-white border border-slate-100 shadow-2xl w-full max-w-md p-8 rounded-[40px] animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6 border-b border-slate-50 pb-5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">إضافة مادة دراسية</h2>
            <p className="text-xs text-slate-400 font-bold mt-0.5">ضمن كارت: {folderName}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700">اسم المادة *</label>
            <Input
              value={subjectName}
              onChange={e => setSubjectName(e.target.value)}
              className="h-12 px-5 rounded-xl border-slate-200 bg-slate-50 focus:bg-white font-bold text-sm"
              placeholder="مثال: لغتي الجميلة، الرياضيات، القرآن"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700">نوع التقييم</label>
            <div className="grid grid-cols-2 gap-3">
              {[{ val: 'text', label: '📝 وصفي / مهارات' }, { val: 'numeric', label: '🔢 درجات رقمية' }].map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setScoreType(opt.val as any)}
                  className={cn(
                    'h-12 rounded-xl border flex items-center justify-center font-black text-xs transition-all',
                    scoreType === opt.val
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {scoreType === 'numeric' && (
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700">الدرجة النهائية</label>
              <Input
                type="number"
                value={maxScore}
                onChange={e => setMaxScore(e.target.value)}
                className="h-12 px-5 rounded-xl border-slate-200 bg-slate-50 font-black text-center text-sm"
              />
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="submit" disabled={isSubmitting} className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-lg text-sm">
              {isSubmitting ? 'جاري الإضافة...' : 'إضافة المادة'}
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
