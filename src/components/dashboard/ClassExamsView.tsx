import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { 
  BookOpen, Plus, Trash2, Edit3, Users, 
  Save, X, Award, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useExamTemplates,
  useStudentGrades,
  useCreateExamTemplate,
  useDeleteExamTemplate,
  useUpsertGrades,
} from '@/hooks/queries';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import { cn } from '@/lib/utils';

interface ClassExamsViewProps {
  classId: string;
  className: string;
}

export default function ClassExamsView({ classId, className }: ClassExamsViewProps) {
  const { toast } = useToast();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  // Create exam form state
  const [newExam, setNewExam] = useState({
    title: '',
    subject: '',
    exam_type: 'monthly',
    max_score: '100',
    term: 'الفصل الأول',
  });

  // Queries
  const { 
    data: templatesData, 
    isLoading: templatesLoading, 
    error: templatesError,
    refetch: refetchTemplates 
  } = useExamTemplates(classId, null, 1, 100);
  
  const templates = templatesData?.data || [];
  
  const { 
    data: studentGradesData,
    isLoading: gradesLoading,
    error: gradesError,
    refetch: refetchGrades
  } = useStudentGrades(selectedTemplateId, classId);

  const studentGrades = useMemo(() => studentGradesData || [], [studentGradesData]);

  // Mutations
  const createExamMutation = useCreateExamTemplate();
  const deleteExamMutation = useDeleteExamTemplate();
  const upsertGradesMutation = useUpsertGrades();

  // Local grades state
  const [localGrades, setLocalGrades] = useState(studentGrades);

  // Sync with DB
  useEffect(() => {
    setLocalGrades(studentGrades);
  }, [studentGrades]);

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExam.title.trim() || !newExam.subject.trim()) return;

    try {
      await createExamMutation.mutateAsync({
        class_id: classId,
        title: newExam.title.trim(),
        subject: newExam.subject.trim(),
        exam_type: newExam.exam_type,
        max_score: Number(newExam.max_score),
        weight: 1,
        term: newExam.term,
        teacher_id: '', // Will be overridden by mutation
      } as any);

      setShowCreateDialog(false);
      setNewExam({
        title: '',
        subject: '',
        exam_type: 'monthly',
        max_score: '100',
        term: 'الفصل الأول',
      });
      
      toast({ title: 'تم إنشاء الاختبار بنجاح' });
      refetchTemplates();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteExam = async (templateId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الاختبار وجميع الدرجات المرتبطة به؟')) return;

    try {
      await deleteExamMutation.mutateAsync(templateId);
      toast({ title: 'تم حذف الاختبار بنجاح' });
      if (selectedTemplateId === templateId) {
        setSelectedTemplateId(null);
      }
      refetchTemplates();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleGradeChange = (studentId: string, score: string) => {
    setLocalGrades(prev => 
      prev.map(g => g.studentId === studentId ? { ...g, score } : g)
    );
  };

  const handleSaveGrades = async () => {
    if (!selectedTemplateId) return;

    const gradesToSave = localGrades
      .filter(g => g.score.trim() !== '')
      .map(g => ({
        student_id: g.studentId,
        exam_template_id: selectedTemplateId,
        score: g.score,
        max_score: Number(newExam.max_score) || 100,
        subject: templates.find(t => t.id === selectedTemplateId)?.subject || '',
        term: templates.find(t => t.id === selectedTemplateId)?.term || '',
        date: new Date().toISOString(),
      }));

    if (gradesToSave.length === 0) {
      toast({ title: 'تنبيه', description: 'لا توجد درجات مكتملة لرصدها' });
      return;
    }

    try {
      await upsertGradesMutation.mutateAsync(gradesToSave);
      toast({ title: 'تم رصد الدرجات بنجاح' });
      refetchGrades();
      refetchTemplates();
    } catch (err: any) {
      toast({ title: 'فشل في الحفظ', description: err.message, variant: 'destructive' });
    }
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  // Show grading view if template is selected
  if (selectedTemplateId && selectedTemplate) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500" dir="rtl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedTemplateId(null)}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white text-slate-600 hover:text-indigo-600 border border-slate-200 flex items-center justify-center transition-all hover:scale-105 shadow-sm"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 truncate">{selectedTemplate.title}</h2>
              <p className="text-[10px] sm:text-sm text-slate-500 font-bold truncate">
                {selectedTemplate.subject} • {selectedTemplate.term} • الدرجة: {selectedTemplate.max_score}
              </p>
            </div>
          </div>
          
          <Button
            onClick={handleSaveGrades}
            disabled={upsertGradesMutation.isPending || localGrades.every(g => !g.score.trim())}
            className="h-12 sm:h-14 px-6 sm:px-8 rounded-xl sm:rounded-2xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all shadow-lg gap-2 text-xs sm:text-sm w-full sm:w-auto"
          >
            <Save className="w-4 h-4 sm:w-5 sm:h-5" />
            {upsertGradesMutation.isPending ? 'جاري الحفظ...' : 'حفظ الدرجات'}
          </Button>
        </div>

        {/* Students Grades Table */}
        <QueryStateHandler
          loading={gradesLoading}
          error={gradesError}
          data={localGrades}
          onRetry={refetchGrades}
          loadingMessage="جاري تحميل بيانات الطلاب..."
        >
          <div className="bg-white border border-slate-200 rounded-[24px] sm:rounded-[32px] overflow-hidden shadow-sm">
            <div className="p-4 sm:p-6 border-b border-slate-100 bg-gradient-to-l from-emerald-50 to-white">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
                <h3 className="text-base sm:text-lg font-black text-slate-900">رصد درجات الطلاب</h3>
                <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold text-[10px] sm:text-xs">
                  {localGrades.length} طالب
                </Badge>
              </div>
            </div>

            <div className="divide-y divide-slate-50">
              {localGrades.map((grade, idx) => (
                <div key={grade.studentId} className="p-4 sm:p-6 flex flex-row items-center justify-between hover:bg-slate-50 transition-colors gap-4">
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-slate-100 flex items-center justify-center text-[10px] sm:text-sm font-black text-slate-500 shrink-0 shadow-inner">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm sm:text-base font-black text-slate-900 truncate">{grade.studentName}</p>
                      <p className="text-[10px] sm:text-xs text-slate-400 font-bold">طالب</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        max={selectedTemplate.max_score}
                        value={grade.score}
                        onChange={(e) => handleGradeChange(grade.studentId, e.target.value)}
                        placeholder="0"
                        className="w-16 sm:w-24 h-10 sm:h-12 px-2 rounded-lg sm:rounded-xl border-2 border-slate-200 text-center font-black text-sm sm:text-base focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                      />
                    </div>
                    <span className="text-[10px] sm:text-sm font-bold text-slate-400 whitespace-nowrap">/ {selectedTemplate.max_score}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </QueryStateHandler>
      </div>
    );
  }

  // Show exams list view
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <BookOpen className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900">الاختبارات والدرجات</h2>
            <p className="text-sm text-slate-500">{className} • {templates.length} اختبار</p>
          </div>
        </div>

        <Button
          onClick={() => setShowCreateDialog(true)}
          className="h-14 px-8 rounded-2xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all shadow-lg gap-2"
        >
          <Plus className="w-5 h-5" />
          إنشاء اختبار جديد
        </Button>
      </div>

      {/* Exams List */}
      <QueryStateHandler
        loading={templatesLoading}
        error={templatesError}
        data={templates}
        onRetry={refetchTemplates}
        loadingMessage="جاري تحميل الاختبارات..."
        emptyMessage="لا توجد اختبارات مسجلة لهذا الفصل"
        isEmpty={templates.length === 0}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-white border-2 border-slate-100 rounded-[32px] p-8 hover:border-emerald-200 hover:shadow-2xl hover:shadow-emerald-100/50 transition-all group cursor-pointer"
              onClick={() => setSelectedTemplateId(template.id)}
            >
              <div className="flex items-start justify-between mb-6">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                  <Award className="w-7 h-7" />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteExam(template.id);
                  }}
                  className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <h3 className="text-xl font-black text-slate-900 mb-2 group-hover:text-emerald-600 transition-colors">
                {template.title}
              </h3>
              
              <div className="space-y-2 mb-6">
                <p className="text-sm text-slate-500 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  {template.subject}
                </p>
                <p className="text-sm text-slate-500 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {template.term}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <Badge className="bg-emerald-50 text-emerald-700 border-none font-bold">
                  {template.exam_type === 'final' ? 'نهائي' : template.exam_type === 'monthly' ? 'شهري' : 'يومي'}
                </Badge>
                <span className="text-sm font-black text-slate-700">
                  الدرجة القصوى: {template.max_score}
                </span>
              </div>
            </div>
          ))}
        </div>
      </QueryStateHandler>

      {/* Create Exam Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md rounded-[40px] p-10 text-right">
          <DialogHeader className="text-right">
            <DialogTitle className="text-2xl font-black text-slate-900">إنشاء اختبار جديد</DialogTitle>
            <DialogDescription className="text-sm font-bold text-slate-400">
              أدخل بيانات الاختبار الجديد للفصل
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateExam} className="mt-8 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">عنوان الاختبار</label>
              <Input
                value={newExam.title}
                onChange={(e) => setNewExam({ ...newExam, title: e.target.value })}
                placeholder="مثال: اختبار الشهر الأول"
                className="h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">المادة</label>
              <Input
                value={newExam.subject}
                onChange={(e) => setNewExam({ ...newExam, subject: e.target.value })}
                placeholder="مثال: الرياضيات"
                className="h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">نوع الاختبار</label>
              <Select
                value={newExam.exam_type}
                onValueChange={(value) => setNewExam({ ...newExam, exam_type: value })}
              >
                <SelectTrigger className="h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">شهري</SelectItem>
                  <SelectItem value="final">نهائي</SelectItem>
                  <SelectItem value="daily">يومي</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">الدرجة القصوى</label>
              <Input
                type="number"
                min="1"
                value={newExam.max_score}
                onChange={(e) => setNewExam({ ...newExam, max_score: e.target.value })}
                className="h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">الفصل الدراسي</label>
              <Select
                value={newExam.term}
                onValueChange={(value) => setNewExam({ ...newExam, term: value })}
              >
                <SelectTrigger className="h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="الفصل الأول">الفصل الأول</SelectItem>
                  <SelectItem value="الفصل الثاني">الفصل الثاني</SelectItem>
                  <SelectItem value="الفصل الثالث">الفصل الثالث</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={createExamMutation.isPending}
                className="flex-1 h-14 rounded-2xl bg-emerald-600 text-white font-black text-lg hover:bg-emerald-700"
              >
                {createExamMutation.isPending ? 'جاري الإنشاء...' : 'إنشاء الاختبار'}
              </Button>
              <Button
                type="button"
                onClick={() => setShowCreateDialog(false)}
                variant="ghost"
                className="h-14 px-8 rounded-2xl bg-slate-50 text-slate-400 font-bold"
              >
                إلغاء
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
