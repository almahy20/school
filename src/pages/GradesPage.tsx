import { useState, useMemo, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { 
  BookOpen, Plus, ClipboardList, Check, Trash2, Users, Save, 
  Search, X, ArrowLeft, ChevronLeft, LayoutGrid, Award,
  Sparkles, History, Filter, AlertCircle, TrendingUp, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useClasses, useBranding, useCurriculumSubjects, useExamTemplates, useStudentGrades, useCreateExamTemplate, useDeleteExamTemplate, useUpsertGrades } from '@/hooks/queries';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import { sendPushToUser } from '@/utils/pushNotifications';

interface ExamTemplate {
  id: string;
  class_id: string;
  subject: string;
  exam_type: string;
  max_score: number;
  weight: number;
  term: string;
  title: string;
  created_at: string;
}

interface StudentGrade {
  studentId: string;
  studentName: string;
  score: string;
  gradeId?: string;
}

const EXAM_TYPES = [
  { value: 'daily', label: 'يومي', color: 'indigo' },
  { value: 'monthly', label: 'شهري', color: 'emerald' },
  { value: 'final', label: 'نهائي', color: 'rose' },
];

export default function GradesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Selection state
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<ExamTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);

  // ── Queries ──
  const { data: branding } = useBranding();
  const { data: classes = [], isLoading: classesLoading, error: classesError, refetch: refetchClasses } = useClasses();
  
  const selectedClass = useMemo(() => 
    classes.find(c => c.id === selectedClassId), 
    [classes, selectedClassId]
  );

  const { data: subjects = [], isLoading: subjectsLoading, error: subjectsError } = useCurriculumSubjects(selectedClass?.curriculum_id || null);
  const { data: templates = [], isLoading: templatesLoading, error: templatesError } = useExamTemplates(selectedClassId, selectedSubject);
  const { data: dbGrades = [], isLoading: gradesLoading, error: gradesError, refetch: refetchGrades, isRefetching } = useStudentGrades(selectedTemplate?.id || null, selectedClassId);

  // Local state for pending grade changes
  const [localGrades, setLocalGrades] = useState<StudentGrade[]>([]);

  // Sync local grades with DB data - use stringify to prevent infinite loop from unstable references
  const dbGradesStr = JSON.stringify(dbGrades);
  useEffect(() => {
    if (dbGrades && dbGrades.length > 0) {
      setLocalGrades(dbGrades);
    }
  }, [dbGradesStr, dbGrades]);

  // Handle first class selection
  useEffect(() => {
    if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  // Handle first subject selection
  useEffect(() => {
    if (subjects.length > 0 && !selectedSubject) {
      setSelectedSubject(subjects[0].subject_name);
    }
  }, [subjects, selectedSubject]);

  // ── Mutations ──
  const upsertMutation = useUpsertGrades();
  const deleteMutation = useDeleteExamTemplate();

  const handleScoreChange = (studentId: string, value: string) => {
    setLocalGrades(prev => prev.map(sg =>
      sg.studentId === studentId ? { ...sg, score: value } : sg
    ));
  };

  const handleSaveAll = async () => {
    if (!selectedTemplate || !user) return;

    const toUpsert = localGrades
      .filter(sg => sg.score !== '')
      .map(sg => {
        const item: any = {
          student_id: sg.studentId,
          teacher_id: user.id,
          school_id: user.schoolId,
          subject: selectedTemplate.subject,
          score: isNaN(Number(sg.score)) ? 0 : Number(sg.score),
          max_score: selectedTemplate.max_score,
          term: selectedTemplate.term,
          exam_template_id: selectedTemplate.id,
        };
        if (sg.gradeId) item.id = sg.gradeId;
        return item;
      });

    if (toUpsert.length === 0) return;

    try {
      await upsertMutation.mutateAsync(toUpsert);
      toast({ title: 'تم حفظ الدرجات بنجاح', description: 'تم تحديث سجلات الطلاب بنجاح.' });
    } catch (err: any) {
      toast({ title: 'خطأ في الحفظ', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا التقييم؟ سيتم حذف جميع الدرجات المرتبطة به.')) return;
    try {
      await deleteMutation.mutateAsync(templateId);
      toast({ title: 'تم الحذف بنجاح' });
      if (selectedTemplate?.id === templateId) {
        setSelectedTemplate(null);
      }
    } catch (err: any) {
      toast({ title: 'خطأ', description: 'فشل في حذف التقييم', variant: 'destructive' });
    }
  };

   const filteredGrades = localGrades.filter(sg => 
      (sg.studentName || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  
   const average = localGrades.length > 0 
     ? Math.round(localGrades.reduce((sum, sg) => sum + (Number(sg.score) || 0), 0) / localGrades.length) 
     : 0;


  return (
    <AppLayout>
      <div className="flex flex-col gap-8 max-w-[1400px] mx-auto text-right pb-14 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        {/* Premium Header - Scaled Down */}
        <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-white/40 backdrop-blur-md p-8 rounded-[40px] border border-white/50 shadow-xl shadow-slate-200/10">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-[24px] bg-white p-3 shadow-lg shadow-indigo-100/50 flex items-center justify-center border border-indigo-50 overflow-hidden shrink-0">
               {branding?.logo_url ? (
                 <img src={branding.logo_url} alt="Logo" className="w-full h-full object-contain" />
               ) : (
                 <BookOpen className="w-8 h-8 text-indigo-600" />
               )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                 <h1 className="text-2xl font-black text-slate-900 tracking-tight">{branding?.name || 'سجل الدرجات'}</h1>
                 <Badge variant="outline" className="rounded-lg bg-indigo-50 border-indigo-100 text-indigo-600 font-black text-[9px] uppercase px-3">منصة المعلم</Badge>
              </div>
              <p className="text-slate-500 font-medium text-sm">إدارة التقييمات الأكاديمية ونتائج الطلاب</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
             <div className="relative group min-w-[180px]">
               <select value={selectedClassId} onChange={e => { setSelectedClassId(e.target.value); setSelectedSubject(''); setSelectedTemplate(null); }}
                 className="w-full pr-10 pl-8 h-11 rounded-xl border-none bg-white text-slate-900 font-black text-xs focus:ring-4 focus:ring-indigo-600/5 transition-all shadow-xl appearance-none cursor-pointer">
                 {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
               </select>
               <Users className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none group-focus-within:text-indigo-600 transition-colors" />
             </div>

             <div className="relative group min-w-[180px]">
               <select value={selectedSubject} onChange={e => { setSelectedSubject(e.target.value); setSelectedTemplate(null); }}
                 disabled={subjects.length === 0}
                 className="w-full pr-10 pl-8 h-11 rounded-xl border-none bg-white text-slate-900 font-black text-xs focus:ring-4 focus:ring-indigo-600/5 transition-all shadow-xl appearance-none cursor-pointer disabled:opacity-50">
                 {subjects.map((s: any) => <option key={s.subject_name} value={s.subject_name}>{s.subject_name}</option>)}
               </select>
               <BookOpen className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none group-focus-within:text-indigo-600 transition-colors" />
             </div>
             
             {selectedClassId && (
               <Button onClick={() => setShowCreateTemplate(true)} className="h-11 px-6 rounded-xl bg-slate-900 text-white font-black text-xs shadow-xl shadow-slate-900/10 hover:scale-[1.02] active:scale-95 transition-all gap-3">
                 <Plus className="w-4.5 h-4.5" /> إضافة اختبار
               </Button>
             )}
          </div>
        </header>

        <QueryStateHandler
          loading={classesLoading || templatesLoading || gradesLoading || subjectsLoading}
          error={classesError || templatesError || gradesError || subjectsError}
          data={classes}
          onRetry={() => {
            refetchClasses();
            refetchGrades();
          }}
          isRefetching={isRefetching}
          loadingMessage="جاري مزامنة السجلات الأكاديمية..."
          emptyMessage="لم يتم العثور على فصول دراسية."
          isEmpty={classes.length === 0}
        >
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
            {/* Left Sidebar: Templates List - Scaled Down */}
            <div className="xl:col-span-4 space-y-6 xl:sticky xl:top-6">
               <div className="flex items-center justify-between px-3">
                  <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">الاختبارات والتقييمات</h2>
                  <Badge variant="outline" className="bg-white text-indigo-600 font-black px-3 py-0.5 rounded-full text-[9px]">{templates.length} اختبار</Badge>
               </div>

               <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                  {templates.length === 0 ? (
                    <div className="bg-white/40 backdrop-blur-sm border border-dashed border-slate-200 p-12 text-center rounded-[32px]">
                       <p className="text-slate-400 font-black text-[9px] uppercase tracking-widest opacity-60">لا توجد اختبارات لهذه المادة</p>
                    </div>
                  ) : templates.map(t => {
                    const isSelected = selectedTemplate?.id === t.id;
                    return (
                      <div key={t.id}
                        onClick={() => setSelectedTemplate(t)}
                        className={cn(
                          "premium-card p-5 cursor-pointer transition-all duration-500 overflow-hidden relative group",
                          isSelected 
                            ? "bg-slate-900 text-white shadow-xl shadow-slate-200 border-none translate-x-2 scale-[1.03]" 
                            : "hover:translate-x-2 shadow-sm"
                        )}>
                        <div className="flex items-start justify-between gap-4 mb-3 relative z-10">
                           <div className="flex-1">
                              <h3 className={cn("text-base font-black tracking-tight", isSelected ? "text-white" : "text-slate-900")}>{t.title}</h3>
                              <p className={cn("text-[8px] uppercase font-black tracking-widest mt-1", isSelected ? "text-indigo-300" : "text-slate-400")}>{t.subject} • {t.term}</p>
                           </div>
                           <button onClick={e => { e.stopPropagation(); handleDeleteTemplate(t.id); }}
                             className={cn(
                               "w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0",
                               isSelected ? "bg-white/10 text-white/40 hover:bg-rose-500/20 hover:text-rose-400" : "bg-slate-50 text-slate-300 hover:text-rose-500"
                             )}>
                             <Trash2 className="w-4 h-4" />
                           </button>
                        </div>
                        <div className="flex items-center gap-2 relative z-10 border-t pt-3 mt-1 border-white/5 disabled:border-slate-50">
                            <span className={cn(
                                "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest",
                                isSelected ? "bg-white/10 text-white" : "bg-slate-100 text-slate-500"
                            )}>
                              {t.exam_type === 'daily' ? 'يومي' : t.exam_type === 'monthly' ? 'شهري' : 'نهائي'}
                            </span>
                            <span className={cn("text-[9px] font-black", isSelected ? "text-white/40" : "text-slate-300")}>الدرجة: {t.max_score}</span>
                        </div>
                        {isSelected && (
                          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-600/20 rounded-bl-[80px] pointer-events-none" />
                        )}
                      </div>
                    );
                  })}
               </div>
            </div>

            {/* Right Column: Grade entry rows - Scaled Down */}
            <div className="xl:col-span-8 space-y-8">
              {!selectedTemplate ? (
                 <div className="bg-white border-2 border-dashed border-slate-100 p-24 text-center rounded-[48px] shadow-sm">
                    <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-[32px] flex items-center justify-center mx-auto mb-6 text-slate-200">
                      <Sparkles className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-2">اختر اختباراً للبدء برصد الدرجات</h3>
                    <p className="text-slate-400 font-medium text-sm max-w-xs mx-auto">قم باختيار الفصل والمادة، ثم حدد الاختبار من القائمة الجانبية لإدخال الدرجات.</p>
                 </div>
              ) : (
                <div className="premium-card p-0 overflow-hidden flex flex-col shadow-xl animate-in slide-in-from-left-6 duration-700">
                   <div className="p-8 border-b border-slate-50 bg-slate-50/20 flex flex-col md:flex-row md:items-center justify-between gap-8">
                      <div className="flex items-center gap-5">
                         <div className="w-16 h-16 rounded-[22px] bg-indigo-600 text-white flex items-center justify-center shadow-xl shadow-indigo-200 shrink-0">
                            <Award className="w-8 h-8" />
                         </div>
                         <div>
                            <div className="flex items-center gap-3 mb-1">
                               <h2 className="text-xl font-black text-slate-900">{selectedTemplate.title}</h2>
                               <Badge className="bg-white border-slate-100 font-black text-[8px] uppercase">{selectedTemplate.subject}</Badge>
                            </div>
                            <div className="flex items-center gap-3 text-[9px] font-black text-slate-300 uppercase tracking-widest mt-1">
                               <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-indigo-400" /> الطلاب: {localGrades.length}</span>
                               <div className="w-1 h-1 rounded-full bg-slate-200" />
                               <span>الفصل: {selectedTemplate.term}</span>
                            </div>
                         </div>
                      </div>

                      <div className="flex items-center gap-3">
                         <div className="relative group w-full md:w-56">
                            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                            <input 
                              type="text" 
                              placeholder="بحث باسم الطالب..." 
                              value={searchQuery}
                              onChange={e => setSearchQuery(e.target.value)}
                              className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-100 bg-white text-xs font-bold shadow-sm focus:ring-4 focus:ring-indigo-600/5 transition-all" 
                            />
                         </div>
                         <Button onClick={handleSaveAll} disabled={upsertMutation.isPending} className="h-12 px-6 rounded-xl bg-slate-900 text-white font-black hover:bg-indigo-600 transition-all text-xs shadow-lg gap-2 shrink-0">
                            {upsertMutation.isPending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4.5 h-4.5" />}
                            {upsertMutation.isPending ? 'جاري الحفظ...' : 'حفظ الدرجات'}
                         </Button>
                      </div>
                   </div>

                   <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto custom-scrollbar">
                      {filteredGrades.length === 0 ? (
                        <div className="p-24 text-center">
                           <Users className="w-12 h-12 text-slate-100 mx-auto mb-4 opacity-50" />
                           <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">لا توجد نتائج</p>
                        </div>
                      ) : (
                        filteredGrades.map((sg, idx) => (
                           <div key={sg.studentId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 px-8 py-5 hover:bg-slate-50/50 transition-all group">
                             <div className="flex items-center gap-4 min-w-0">
                               <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-300 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-inner shrink-0">
                                  {idx + 1}
                               </div>
                               <div className="min-w-0">
                                  <h3 className="text-base font-black text-slate-800 transition-colors truncate leading-tight mb-1 group-hover:text-indigo-600">{sg.studentName}</h3>
                                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest opacity-60">إدخال درجة الطالب</p>
                               </div>
                             </div>

                             <div className="relative group/input w-full sm:w-48">
                               <input
                                 type="text"
                                 value={sg.score}
                                 onChange={e => handleScoreChange(sg.studentId, e.target.value)}
                                 placeholder="درجة أو نص..."
                                 className="w-full h-12 px-6 rounded-2xl border border-slate-100 bg-white text-slate-900 font-black text-base text-center focus:outline-none focus:border-indigo-600/30 transition-all focus:ring-8 focus:ring-indigo-600/5 shadow-inner"
                               />
                               <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-200 uppercase pointer-events-none tracking-widest">
                                 / {selectedTemplate.max_score}
                               </div>
                             </div>
                           </div>
                        ))
                      )}
                   </div>
                </div>
              )}
            </div>
          </div>
        </QueryStateHandler>
      </div>

      {showCreateTemplate && (
        <CreateTemplateModal
          classId={selectedClassId}
          teacherId={user!.id}
          user={user}
          subjects={subjects}
          onClose={() => setShowCreateTemplate(false)}
          onCreated={(t: any) => {
            setSelectedTemplate(t);
            setShowCreateTemplate(false);
          }}
        />
      )}
    </AppLayout>
  );
}

// ─── Create Template Modal (Scaled Down) ─────────────────────────────────────
function CreateTemplateModal({ classId, teacherId, user, subjects, onClose, onCreated }: any) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [examType, setExamType] = useState('monthly');
  const [maxScore, setMaxScore] = useState('100');
  const [weight, setWeight] = useState('1');
  const [term, setTerm] = useState('الفصل الأول');
  const createMutation = useCreateExamTemplate();

  useEffect(() => {
    if (subjects.length > 0 && !subject) setSubject(subjects[0].subject_name);
  }, [subjects, subject]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    
    try {
      const data = await createMutation.mutateAsync({
        class_id: classId,
        teacher_id: teacherId,
        subject: subject.trim(),
        exam_type: examType,
        max_score: Number(maxScore),
        weight: Number(weight),
        term,
        title: title.trim() || subject.trim(),
      });
      onCreated(data);
    } catch (err) {
      // toast handled via mutation? or here
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-right animate-in fade-in" onClick={onClose}>
      <div className="bg-white border border-slate-100 shadow-2xl w-full max-w-lg p-8 rounded-[40px] animate-in zoom-in-95 relative overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-bl-[80px]" />
        <h2 className="text-2xl font-black text-slate-900 mb-8 tracking-tight relative z-10">إعداد اختبار جديد</h2>
        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">اسم الاختبار</label>
            <Input value={title} onChange={e => setTitle(e.target.value)}
              className="h-11 px-5 rounded-xl border-slate-100 bg-slate-50 focus:bg-white font-bold text-sm"
              placeholder="مثال: تقييم الأسبوع الرابع" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">المادة الدراسية *</label>
            <select value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full h-11 px-5 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold appearance-none">
              {subjects.map((s: any) => <option key={s.subject_name} value={s.subject_name}>{s.subject_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
               <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">نوع التقييم</label>
               <select value={examType} onChange={e => setExamType(e.target.value)}
                 className="w-full h-11 px-5 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold appearance-none">
                 {EXAM_TYPES.map(et => <option key={et.value} value={et.value}>{et.label}</option>)}
               </select>
            </div>
            <div className="space-y-1.5">
               <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">الفصل الدراسي</label>
               <select value={term} onChange={e => setTerm(e.target.value)}
                 className="w-full h-11 px-5 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold appearance-none">
                 <option value="الفصل الأول">الفصل الأول</option>
                 <option value="الفصل الثاني">الفصل الثاني</option>
               </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">الدرجة النهائية</label>
                <Input type="number" value={maxScore} onChange={e => setMaxScore(e.target.value)}
                  className="h-11 px-5 rounded-xl border-slate-100 bg-slate-50 focus:bg-white font-bold text-center text-sm" />
             </div>
             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">الوزن (%)</label>
                <Input type="number" value={weight} onChange={e => setWeight(e.target.value)}
                  className="h-11 px-5 rounded-xl border-slate-100 bg-slate-50 focus:bg-white font-bold text-center text-sm" />
             </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={createMutation.isPending}
              className="flex-1 h-12 rounded-xl bg-slate-900 text-white font-black shadow-lg hover:bg-indigo-600 transition-all text-sm">
              {createMutation.isPending ? 'جاري الحفظ...' : 'تأكيد وحفظ'}
            </Button>
            <Button type="button" onClick={onClose} variant="ghost"
              className="flex-1 h-12 rounded-xl bg-slate-50 text-slate-500 font-black text-sm">إلغاء</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
