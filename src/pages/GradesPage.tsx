import { useState, useMemo, useEffect } from 'react';
import { useSessionState } from '@/hooks/useSessionState';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { 
  BookOpen, Plus, ClipboardList, Check, Trash2, Users, Save, 
  Search, X, ArrowLeft, ChevronLeft, LayoutGrid, Award,
  Sparkles, History, Filter, AlertCircle, TrendingUp, Info, FolderOpen, FileText
} from 'lucide-react';
import { cn, getOptimizedImageUrl } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from '@/components/ui/use-toast';
import { useClasses, useBranding, useCurriculumSubjects, useExamTemplates, useStudentGrades, useCreateExamTemplate, useDeleteExamTemplate, useUpsertGrades } from '@/hooks/queries';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  score_type?: 'numeric' | 'text';
  expected_results?: string[];
}

interface StudentGrade {
  studentId: string;
  studentName: string;
  score: string;
  gradeId?: string;
}

export default function GradesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Selection state (session-persistent)
  const [selectedClassId, setSelectedClassId] = useSessionState<string>('grades:selectedClassId', '');
  const [selectedMonthFolder, setSelectedMonthFolder] = useSessionState<string>('grades:selectedMonthFolder', '');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<ExamTemplate | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
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
  const { data: templatesResponse, isLoading: templatesLoading, error: templatesError } = useExamTemplates(selectedClassId, null, 1, 100);
  const allTemplates = templatesResponse?.data || [];

  // Group templates by Month Card / Term (e.g. "تقييم شهر 7", "تقييم شهر 8")
  const monthFolders = useMemo(() => {
    const folders: Record<string, ExamTemplate[]> = {};
    allTemplates.forEach(t => {
      const folderName = t.term || t.title || 'تقييم شهري';
      if (!folders[folderName]) folders[folderName] = [];
      folders[folderName].push(t);
    });
    return folders;
  }, [allTemplates]);

  // Set default class
  useEffect(() => {
    if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  // Auto select first month folder
  const monthFolderKeys = Object.keys(monthFolders);
  useEffect(() => {
    if (monthFolderKeys.length > 0 && !selectedMonthFolder) {
      setSelectedMonthFolder(monthFolderKeys[0]);
    }
  }, [monthFolderKeys, selectedMonthFolder]);

  // Active templates for current month folder
  const currentMonthTemplates = useMemo(() => {
    if (!selectedMonthFolder) return [];
    return monthFolders[selectedMonthFolder] || [];
  }, [selectedMonthFolder, monthFolders]);

  // Auto select template when subject or month folder changes
  useEffect(() => {
    if (currentMonthTemplates.length > 0) {
      if (selectedSubject) {
        const found = currentMonthTemplates.find(t => t.subject === selectedSubject);
        if (found) {
          setSelectedTemplate(found);
          return;
        }
      }
      setSelectedTemplate(currentMonthTemplates[0]);
      setSelectedSubject(currentMonthTemplates[0].subject);
    } else {
      setSelectedTemplate(null);
    }
  }, [selectedMonthFolder, selectedSubject, currentMonthTemplates]);

  const { data: dbGrades = [], isLoading: gradesLoading, error: gradesError, refetch: refetchGrades, isRefetching } = useStudentGrades(selectedTemplate || null, selectedClassId);

  // Local state for pending grade changes
  const [localGrades, setLocalGrades] = useState<StudentGrade[]>([]);

  const dbGradesStr = JSON.stringify(dbGrades);
  useEffect(() => {
    if (dbGrades && dbGrades.length > 0) {
      setLocalGrades(dbGrades);
    }
  }, [dbGradesStr, dbGrades]);

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
          score: sg.score,
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
      toast({ title: 'تم حفظ التقييمات بنجاح', description: 'تم تحديث سجلات الطلاب بنجاح.' });
    } catch (err: any) {
      toast({ title: 'خطأ في الحفظ', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await deleteMutation.mutateAsync(templateId);
      toast({ title: 'تم الحذف بنجاح' });
      if (selectedTemplate?.id === templateId) {
        setSelectedTemplate(null);
      }
    } catch (err: any) {
      toast({ title: 'خطأ', description: 'فشل في حذف التقييم', variant: 'destructive' });
    } finally {
      setDeleteTemplateId(null);
    }
  };

  const filteredGrades = localGrades.filter(sg => 
    (sg.studentName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 max-w-[1400px] mx-auto text-right pb-14 animate-in fade-in slide-in-from-bottom-4 duration-1000" dir="rtl">
        {/* Premium Header */}
        <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-white/40 backdrop-blur-md p-8 rounded-[40px] border border-white/50 shadow-xl shadow-slate-200/10">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-[24px] bg-white p-3 shadow-lg shadow-indigo-100/50 flex items-center justify-center border border-indigo-50 overflow-hidden shrink-0">
               {branding?.logo_url ? (
                 <img src={getOptimizedImageUrl(branding.logo_url, { width: 120, quality: 75 })} alt="Logo" className="w-full h-full object-contain" loading="lazy" />
               ) : (
                 <Award className="w-8 h-8 text-indigo-600" />
               )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                 <h1 className="text-2xl font-black text-slate-900 tracking-tight">{branding?.name || 'رصد التقييمات والنتائج'}</h1>
                 <Badge variant="outline" className="rounded-lg bg-indigo-50 border-indigo-100 text-indigo-600 font-black text-[9px] uppercase px-3">لوحة الإدارة والتقييم</Badge>
              </div>
              <p className="text-slate-500 font-medium text-sm">إنشاء التقييمات الشهرية ورصد نتائج الطلاب بسهولة وبدون تكرار</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
             {/* Class Picker */}
             <div className="relative group min-w-[200px]">
               <select 
                 value={selectedClassId} 
                 onChange={e => { 
                   setSelectedClassId(e.target.value); 
                   setSelectedMonthFolder('');
                   setSelectedSubject(''); 
                   setSelectedTemplate(null); 
                 }}
                 className="w-full pr-10 pl-8 h-12 rounded-xl border-none bg-white text-slate-900 font-black text-sm focus:ring-4 focus:ring-indigo-600/5 transition-all shadow-xl appearance-none cursor-pointer"
               >
                 {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
               </select>
               <Users className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
             </div>
             
             {selectedClassId && (
               <Button 
                 onClick={() => setShowCreateTemplate(true)} 
                 className="h-12 px-6 rounded-xl bg-slate-900 text-white font-black text-xs shadow-xl shadow-slate-900/10 hover:bg-indigo-600 transition-all gap-3"
               >
                 <Plus className="w-5 h-5" /> إنشاء تقييم شهري جديد
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
          loadingMessage="جاري مزامنة بيانات التقييمات..."
          emptyMessage="لم يتم العثور على فصول دراسية."
          isEmpty={classes.length === 0}
        >
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
            {/* Left Sidebar: Month Cards & Subjects */}
            <div className="xl:col-span-4 space-y-6 xl:sticky xl:top-6">
               <div className="flex items-center justify-between px-3">
                  <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest leading-none flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-indigo-600" />
                    كروت التقييمات الشهرية
                  </h2>
                  <Badge variant="outline" className="bg-white text-indigo-600 font-black px-3 py-0.5 rounded-full text-xs">
                    {monthFolderKeys.length} شهور
                  </Badge>
               </div>

               {/* Month Cards Grid */}
               <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                  {monthFolderKeys.length === 0 ? (
                    <div className="bg-white/60 border border-dashed border-slate-200 p-10 text-center rounded-[32px] space-y-3">
                       <FolderOpen className="w-10 h-10 text-slate-300 mx-auto" />
                       <p className="text-slate-400 font-bold text-xs">لا توجد تقييمات شهرية حتى الآن لهذا الفصل</p>
                       <Button 
                         onClick={() => setShowCreateTemplate(true)}
                         className="bg-indigo-600 text-white font-bold text-xs rounded-xl h-10 px-4"
                       >
                         إضافة أول تقييم شهري
                       </Button>
                    </div>
                  ) : (
                    monthFolderKeys.map((folderName) => {
                      const isFolderSelected = selectedMonthFolder === folderName;
                      const folderTemplates = monthFolders[folderName] || [];

                      return (
                        <div
                          key={folderName}
                          onClick={() => {
                            setSelectedMonthFolder(folderName);
                            if (folderTemplates.length > 0) {
                              setSelectedTemplate(folderTemplates[0]);
                              setSelectedSubject(folderTemplates[0].subject);
                            }
                          }}
                          className={cn(
                            "premium-card p-5 cursor-pointer transition-all duration-300 overflow-hidden relative group rounded-[24px] border",
                            isFolderSelected 
                              ? "bg-slate-900 text-white shadow-xl border-slate-900" 
                              : "bg-white text-slate-900 border-slate-100 hover:border-indigo-100 hover:shadow-md"
                          )}
                        >
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <h3 className={cn("text-lg font-black tracking-tight", isFolderSelected ? "text-white" : "text-slate-900")}>
                              📁 {folderName}
                            </h3>
                            <Badge className={cn("text-xs font-bold px-2.5 py-1 rounded-lg", isFolderSelected ? "bg-indigo-500/20 text-indigo-200" : "bg-indigo-50 text-indigo-700")}>
                              {folderTemplates.length} مواد
                            </Badge>
                          </div>

                          {/* Subjects Chips inside Month Card */}
                          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100/10">
                            {folderTemplates.map((t) => (
                              <button
                                key={t.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedMonthFolder(folderName);
                                  setSelectedTemplate(t);
                                  setSelectedSubject(t.subject);
                                }}
                                className={cn(
                                  "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                                  selectedTemplate?.id === t.id
                                    ? "bg-indigo-600 text-white shadow-xs"
                                    : isFolderSelected
                                    ? "bg-white/10 text-slate-300 hover:bg-white/20"
                                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                                )}
                              >
                                {t.subject}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
               </div>
            </div>

            {/* Right Main Column: Grade entry for active selected template */}
            <div className="xl:col-span-8 space-y-6">
              {!selectedTemplate ? (
                 <div className="bg-white border-2 border-dashed border-slate-100 p-20 text-center rounded-[40px] shadow-sm">
                    <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-[32px] flex items-center justify-center mx-auto mb-6 text-slate-300">
                      <Sparkles className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-2">اختر أو أنشئ كارت تقييم شهري للبدء</h3>
                    <p className="text-slate-400 font-medium text-sm max-w-sm mx-auto">
                      قم باختيار التقييم الشهري من الكروت الجانبية ثم حدد المادة لرصد الدرجات والتقييم النصي للطلاب.
                    </p>
                 </div>
              ) : (
                <div className="bg-white border border-slate-100 rounded-[36px] overflow-hidden shadow-xl animate-in slide-in-from-left-6 duration-700">
                   {/* Subject & Evaluation Bar */}
                   <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-center gap-4">
                         <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shrink-0">
                            <BookOpen className="w-7 h-7" />
                         </div>
                         <div>
                            <div className="flex items-center gap-2 mb-1">
                               <h2 className="text-xl font-black text-slate-900">{selectedTemplate.subject}</h2>
                               <Badge className="bg-indigo-50 text-indigo-700 font-bold text-xs px-3 py-0.5">
                                 {selectedTemplate.term || selectedTemplate.title}
                               </Badge>
                            </div>
                            <p className="text-xs text-slate-400 font-bold">
                              نظام التقييم: {selectedTemplate.score_type === 'text' ? 'تقييم نصي / وصفي' : `درجات رقمية (من ${selectedTemplate.max_score})`}
                            </p>
                         </div>
                      </div>

                      <div className="flex items-center gap-3">
                         <div className="relative min-w-[200px]">
                            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                            <Input 
                              value={searchQuery}
                              onChange={e => setSearchQuery(e.target.value)}
                              placeholder="بحث باسم الطالب..."
                              className="pr-10 h-11 bg-white border-slate-200 text-xs font-bold rounded-xl"
                            />
                         </div>

                         <Button 
                           onClick={() => selectedTemplate && setDeleteTemplateId(selectedTemplate.id)}
                           variant="ghost"
                           className="h-11 px-3 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-all"
                         >
                           <Trash2 className="w-4.5 h-4.5" />
                         </Button>

                         <Button 
                           onClick={handleSaveAll}
                           disabled={upsertMutation.isPending}
                           className="h-11 px-6 rounded-xl bg-indigo-600 text-white font-black text-xs shadow-lg hover:bg-indigo-700 transition-all gap-2"
                         >
                           <Save className="w-4.5 h-4.5" />
                           {upsertMutation.isPending ? 'جاري الحفظ...' : 'حفظ الكل'}
                         </Button>
                      </div>
                   </div>

                   {/* Student Grades Entry Table */}
                   <div className="p-6">
                      <div className="divide-y divide-slate-100">
                         {filteredGrades.length === 0 ? (
                           <div className="py-12 text-center text-slate-400 font-bold text-sm">
                             لا يوجد طلاب مسجلون في هذا الفصل
                           </div>
                         ) : (
                           filteredGrades.map((sg) => (
                             <div key={sg.studentId} className="py-4 px-4 flex items-center justify-between hover:bg-slate-50/50 rounded-2xl transition-colors gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                   <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-700 shrink-0">
                                      {sg.studentName[0]}
                                   </div>
                                   <span className="font-black text-slate-800 text-sm truncate">{sg.studentName}</span>
                                </div>

                                <div className="flex items-center gap-3 w-full max-w-xs sm:max-w-md">
                                   {selectedTemplate.score_type === 'text' ? (
                                     <Input
                                       value={sg.score}
                                       onChange={e => handleScoreChange(sg.studentId, e.target.value)}
                                       placeholder="مثال: ممتاز في القراءة والاستيعاب"
                                       className="h-11 bg-slate-50 border-slate-200 text-xs font-bold rounded-xl focus:bg-white transition-all text-right"
                                     />
                                   ) : (
                                     <div className="flex items-center gap-2 w-full justify-end">
                                       <Input
                                         type="number"
                                         value={sg.score}
                                         onChange={e => handleScoreChange(sg.studentId, e.target.value)}
                                         placeholder="الدرجة"
                                         className="h-11 bg-slate-50 border-slate-200 text-sm font-black rounded-xl focus:bg-white transition-all text-center w-28"
                                       />
                                       <span className="text-xs font-bold text-slate-400">/ {selectedTemplate.max_score}</span>
                                     </div>
                                   )}
                                </div>
                             </div>
                           ))
                         )}
                      </div>
                   </div>
                </div>
              )}
            </div>
          </div>
        </QueryStateHandler>

        {/* Modal: Create New Monthly Evaluation Session (For All Subjects at once) */}
        {showCreateTemplate && (
          <CreateMonthlyEvaluationModal 
            classId={selectedClassId}
            className={selectedClass?.name || ''}
            subjects={subjects}
            onClose={() => setShowCreateTemplate(false)}
            onSuccess={() => {
              setShowCreateTemplate(false);
              refetchClasses();
            }}
          />
        )}

        <AlertDialog open={!!deleteTemplateId} onOpenChange={(open) => { if (!open) setDeleteTemplateId(null); }}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>حذف التقييم</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف هذا التقييم والمادة التابعة له؟ لا يمكن التراجع عن هذا الإجراء.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => deleteTemplateId && handleDeleteTemplate(deleteTemplateId)}
              >
                حذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}

// Modal component for creating a month evaluation folder for ALL subjects in 1-click
function CreateMonthlyEvaluationModal({ 
  classId, 
  className,
  subjects, 
  onClose, 
  onSuccess 
}: { 
  classId: string;
  className: string;
  subjects: any[]; 
  onClose: () => void; 
  onSuccess: () => void; 
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
    if (!monthTitle.trim() || !classId) return;

    if (subjects.length === 0) {
      toast({ title: 'تنبيه', description: 'لا توجد مواد مضافة لهذا الفصل بعد. يرجى ربط منهج بالفصل أولاً.', variant: 'destructive' });
      return;
    }

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
        teacher_id: user?.id || '',
      });

      toast({ 
        title: 'تم إنشاء التقييم الشهري بنجاح! 🌟', 
        description: `يمكنك الآن إضافة المواد يدوياً من داخل الكارت.` 
      });
      onSuccess();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-right animate-in fade-in" onClick={onClose} dir="rtl">
      <div className="bg-white border border-slate-100 shadow-2xl w-full max-w-lg p-8 rounded-[40px] animate-in zoom-in-95 relative overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">إنشاء كارت تقييم شهري جديد</h2>
            <p className="text-xs text-slate-400 font-bold mt-0.5">{className}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700">اسم التقييم الشهري *</label>
            <Input 
              value={monthTitle} 
              onChange={e => setMonthTitle(e.target.value)}
              className="h-12 px-5 rounded-xl border-slate-200 bg-slate-50 focus:bg-white font-bold text-sm"
              placeholder="مثال: تقييم شهر 7 أو تقييم شهر أكتوبر" 
              required
            />
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
