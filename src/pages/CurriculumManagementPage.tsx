import { useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  BookOpen, Plus, Edit3, Trash2, Layers, Search, 
  ArrowRight, ChevronDown, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  useCurriculums, 
  useCurriculumSubjects, 
  useUpsertCurriculum, 
  useDeleteCurriculum, 
  useUpsertSubject, 
  useDeleteSubject, 
  useAssignCurriculumToClass,
  useClasses
} from '@/hooks/queries';
import { QueryStateHandler } from '@/components/QueryStateHandler';

export default function CurriculumManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Selection & UI State
  const [selectedCurriculum, setSelectedCurriculum] = useState<any | null>(null);
  const [showAddCurriculum, setShowAddCurriculum] = useState(false);
  const [newCurriculum, setNewCurriculum] = useState({ name: '', status: 'active' as 'active' | 'inactive' });
  const [editingCurriculum, setEditingCurriculum] = useState<any | null>(null);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubject, setNewSubject] = useState({ subject_name: '', content: '' });
  const [editingSubject, setEditingSubject] = useState<any | null>(null);
  const [assignClassCurriculum, setAssignClassCurriculum] = useState<any | null>(null);
  const [selectedCurriculumForClass, setSelectedCurriculumForClass] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Queries ──
  const { data: curriculums = [], isLoading: curriculumsLoading, error: curriculumsError, refetch: refetchCurriculums } = useCurriculums();
    const { data: classesData, isLoading: classesLoading } = useClasses();
    const classes = (classesData?.data || []) as Array<{id: string; name: string}>;
  const { data: curriculumSubjects = [], isLoading: subjectsLoading, error: subjectsError, refetch: refetchSubjects } = useCurriculumSubjects(selectedCurriculum?.id || null);

  // ── Mutations ──
  const upsertCurriculumMutation = useUpsertCurriculum();
  const deleteCurriculumMutation = useDeleteCurriculum();
  const upsertSubjectMutation = useUpsertSubject();
  const deleteSubjectMutation = useDeleteSubject();
  const assignCurriculumMutation = useAssignCurriculumToClass();

  const handleAddCurriculum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCurriculum.name.trim()) return;
    try {
      await upsertCurriculumMutation.mutateAsync({
        name: newCurriculum.name.trim(),
        status: newCurriculum.status,
      });
      setShowAddCurriculum(false);
      setNewCurriculum({ name: '', status: 'active' });
      toast({ title: 'تم إضافة المنهج بنجاح' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleEditCurriculum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCurriculum || !editingCurriculum.name.trim()) return;
    try {
      await upsertCurriculumMutation.mutateAsync({
        id: editingCurriculum.id,
        name: editingCurriculum.name.trim(),
        status: editingCurriculum.status,
      });
      setEditingCurriculum(null);
      toast({ title: 'تم تحديث المنهج بنجاح' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteCurriculum = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المنهج؟ سيتم إلغاء ربطه بجميع الفصول التابعة له.')) return;
    try {
      await deleteCurriculumMutation.mutateAsync(id);
      if (selectedCurriculum?.id === id) setSelectedCurriculum(null);
      toast({ title: 'تم حذف المنهج بنجاح' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleAddSubjectToCurriculum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCurriculum || !newSubject.subject_name.trim()) return;
    try {
      await upsertSubjectMutation.mutateAsync({
        curriculum_id: selectedCurriculum.id,
        subject_name: newSubject.subject_name.trim(),
        content: newSubject.content.trim() || null,
      });
      setShowAddSubject(false);
      setNewSubject({ subject_name: '', content: '' });
      toast({ title: 'تم إضافة المادة للمنهج بنجاح' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleEditCurriculumSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject || !editingSubject.subject_name.trim()) return;
    try {
      await upsertSubjectMutation.mutateAsync({
        id: editingSubject.id,
        curriculum_id: editingSubject.curriculum_id,
        subject_name: editingSubject.subject_name.trim(),
        content: editingSubject.content?.trim() || null,
      });
      setEditingSubject(null);
      toast({ title: 'تم تحديث المادة بنجاح' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteCurriculumSubject = async (id: string, curriculumId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه المادة من المنهج؟')) return;
    try {
      await deleteSubjectMutation.mutateAsync({ id, curriculumId });
      toast({ title: 'تم حذف المادة بنجاح' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleAssignCurriculumToClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignClassCurriculum) return;
    try {
      await assignCurriculumMutation.mutateAsync({
        classId: assignClassCurriculum.id,
        curriculumId: selectedCurriculumForClass,
      });
      setAssignClassCurriculum(null);
      setSelectedCurriculumForClass(null);
      toast({ title: 'تم تحديث ربط المنهج بالفصل بنجاح' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const filteredCurriculums = useMemo(() => {
    return curriculums.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [curriculums, searchQuery]);

  const loading = curriculumsLoading || classesLoading;

  return (
    <AppLayout>
      <div className="flex flex-col gap-10 max-w-[1500px] mx-auto text-right animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
        <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 bg-white/40 backdrop-blur-md p-10 sm:p-14 rounded-[56px] border border-white/50 shadow-xl shadow-slate-200/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          <div className="space-y-4 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-[22px] bg-slate-900 flex items-center justify-center text-white shadow-2xl rotate-3 group-hover:rotate-0 transition-all duration-500">
                 <BookOpen className="w-7 h-7" />
              </div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">إدارة المناهج الدراسية</h1>
            </div>
            <p className="text-slate-500 font-medium text-lg pr-1">بناء الخطط الأكاديمية وربط المسارات التعليمية بالفصول الدراسية.</p>
          </div>
          
          <Button 
            onClick={() => setShowAddCurriculum(true)}
            className="h-16 px-10 rounded-[24px] bg-indigo-600 text-white font-black hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-indigo-200 relative z-10 gap-3 text-lg"
          >
            <Plus className="w-6 h-6" />
            إنشاء منهج جديد
          </Button>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
          {/* Curriculums List */}
          <div className="xl:col-span-4 space-y-8">
            <div className="flex flex-col gap-6 px-6">
              <div className="flex items-center gap-3">
                <Layers className="w-5 h-5 text-indigo-600" />
                <h2 className="text-xl font-black text-slate-900">المسارات المتاحة</h2>
              </div>

              <div className="relative group">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                <Input 
                  placeholder="بحث في المناهج..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="h-12 pr-10 pl-4 rounded-2xl bg-white border-slate-100 font-bold text-xs focus:ring-4 focus:ring-indigo-600/5 transition-all"
                />
              </div>
            </div>
            
            <QueryStateHandler
              loading={curriculumsLoading}
              error={curriculumsError}
              data={curriculums}
              onRetry={refetchCurriculums}
              isEmpty={filteredCurriculums.length === 0}
              loadingMessage="جاري مزامنة المناهج..."
              emptyMessage={searchQuery ? 'لا توجد نتائج للبحث' : 'ابدأ بإنشاء أول منهج دراسي'}
            >
              <div className="space-y-5">
                {filteredCurriculums.map(curriculum => (
                  <div
                    key={curriculum.id}
                    onClick={() => setSelectedCurriculum(curriculum)}
                    className={cn(
                      "w-full p-8 rounded-[40px] border-2 transition-all flex items-center justify-between group relative cursor-pointer outline-none focus:ring-4 focus:ring-indigo-600/5",
                      selectedCurriculum?.id === curriculum.id 
                        ? "bg-white border-indigo-600 shadow-2xl shadow-indigo-100" 
                        : "bg-white border-transparent hover:border-slate-100 hover:shadow-xl shadow-sm"
                    )}
                  >
                    {selectedCurriculum?.id === curriculum.id && <div className="absolute right-0 top-0 w-2 h-full bg-indigo-600" />}
                    
                    <div className="flex items-center gap-6">
                      <div className={cn(
                        "w-14 h-14 rounded-[20px] flex items-center justify-center text-white shadow-xl",
                        curriculum.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'
                      )}>
                        <BookOpen className="w-7 h-7" />
                      </div>
                      <div className="text-right">
                        <h3 className={cn("font-black text-xl transition-colors", selectedCurriculum?.id === curriculum.id ? "text-indigo-600" : "text-slate-900")}>{curriculum.name}</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5 leading-none">
                          {curriculum.status === 'active' ? 'مسار تعليمي نشط' : 'مسار غير نشط'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                       <button 
                        onClick={(e) => { e.stopPropagation(); setEditingCurriculum(curriculum); }}
                        className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteCurriculum(curriculum.id); }}
                        className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </QueryStateHandler>
          </div>

          {/* Curriculum Details & Subjects */}
          <div className="xl:col-span-8">
            {selectedCurriculum ? (
              <div className="bg-white rounded-[56px] border border-slate-100 shadow-2xl shadow-slate-200/20 p-12 space-y-12 animate-in fade-in zoom-in-95 duration-700 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 pb-10 border-b border-slate-50">
                   <div className="flex items-center gap-8">
                      <div className={cn("w-20 h-20 rounded-[28px] flex items-center justify-center text-white shadow-2xl", selectedCurriculum.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500')}>
                         <BookOpen className="w-10 h-10" />
                      </div>
                      <div className="space-y-2">
                         <h2 className="text-4xl font-black text-slate-900 tracking-tight">{selectedCurriculum.name}</h2>
                         <div className="flex items-center gap-3">
                            <Badge variant="outline" className={cn("px-4 py-1 rounded-full font-black text-[9px] uppercase", selectedCurriculum.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100')}>
                               {selectedCurriculum.status === 'active' ? 'نشط' : 'غير نشط'}
                            </Badge>
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                            <span className="text-slate-400 font-black text-[10px] uppercase tracking-widely">{curriculumSubjects.length} مواد دراسية حالية</span>
                         </div>
                      </div>
                   </div>
                   <Button 
                     onClick={() => setShowAddSubject(true)}
                     className="h-14 px-8 rounded-2xl bg-slate-900 text-white font-black hover:scale-105 active:scale-95 transition-all shadow-xl shadow-slate-200 gap-3"
                   >
                     <Plus className="w-5 h-5" />
                     إضافة مادة للمنهج
                   </Button>
                </div>

                {/* Subjects in Curriculum */}
                <QueryStateHandler
                  loading={subjectsLoading}
                  error={subjectsError}
                  data={curriculumSubjects}
                  onRetry={refetchSubjects}
                  loadingMessage="جاري تحميل الخطة الدراسية..."
                  emptyMessage="لا توجد موارد تعليمية مضافة حالياً."
                  isEmpty={curriculumSubjects.length === 0}
                >
                  <div className="grid grid-cols-1 gap-6">
                      {curriculumSubjects.map(subject => (
                        <div key={subject.id} className="p-8 rounded-[32px] border border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-6 group/sub hover:bg-white hover:border-indigo-100 hover:shadow-xl transition-all duration-500">
                          <div className="flex items-center gap-6">
                            <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-sm group-hover/sub:scale-110 transition-transform">
                              <BookOpen className="w-7 h-7" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-xl font-black text-slate-900">{subject.subject_name}</p>
                              <p className="text-xs font-medium text-slate-500 leading-relaxed max-w-lg">{subject.content || 'لم يتم تحديد المحتوى الأكاديمي لهذه المادة بعد.'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 self-end md:self-center">
                            <button 
                              onClick={() => setEditingSubject(subject)}
                              className="w-10 h-10 rounded-xl bg-white text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center shadow-sm"
                            >
                              <Edit3 className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteCurriculumSubject(subject.id, subject.curriculum_id)}
                              className="w-10 h-10 rounded-xl bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all flex items-center justify-center shadow-sm"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </QueryStateHandler>

                {/* Classes linked to this curriculum */}
                <div className="space-y-8 pt-12 border-t border-slate-50">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                       <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tight">الفصول الدراسية المرتبطة</h3>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pr-1">تحديد الفصول التي تتبع هذا المسار التعليمي</p>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        const availableClasses = classes.filter(cls => !cls.curriculum_id);
                        if (availableClasses.length === 0) {
                          toast({ title: 'تنبيه', description: 'جميع الفصول مرتبطة بمناهج دراسية بالفعل.' });
                          return;
                        }
                        setAssignClassCurriculum(availableClasses[0]);
                        setSelectedCurriculumForClass(selectedCurriculum.id);
                      }}
                      className="rounded-2xl border-slate-200 text-slate-900 hover:bg-slate-50 font-black text-xs h-12 px-8 shadow-sm"
                    >
                      <Layers className="w-4 h-4 ml-2" />
                      ربط فصل إضافي
                    </Button>
                  </div>
                  
                  {classes.filter(cls => cls.curriculum_id === selectedCurriculum.id).length === 0 ? (
                    <div className="p-14 text-center bg-slate-50/50 rounded-[40px] border border-dashed border-slate-200">
                      <p className="text-sm font-bold text-slate-400">لا توجد فصول مرتبطة بهذا المسار التعليمي حالياً.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {classes.filter(cls => cls.curriculum_id === selectedCurriculum.id).map(cls => (
                        <div key={cls.id} className="p-6 rounded-3xl bg-white border border-slate-100 flex items-center justify-between group/cls hover:border-rose-100 transition-all">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs uppercase">
                               {cls.name.trim()[0]}
                             </div>
                             <span className="text-lg font-black text-slate-900">{cls.name}</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              if (confirm(`هل أنت متأكد من إلغاء ربط المنهج بالفصل ${cls.name}؟`)) {
                                assignCurriculumMutation.mutate({ classId: cls.id, curriculumId: null });
                              }
                            }}
                            className="text-rose-500 hover:bg-rose-50 opacity-0 group-hover/cls:opacity-100 transition-all font-black text-[10px] uppercase"
                          >
                            إلغاء الربط
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[600px] flex flex-col items-center justify-center gap-10 bg-white/40 backdrop-blur-md rounded-[56px] border border-dashed border-slate-200 p-20 text-center group">
                 <div className="relative">
                    <div className="absolute -inset-10 bg-indigo-500/5 rounded-full blur-3xl group-hover:bg-indigo-500/10 transition-all" />
                    <div className="w-32 h-32 rounded-[48px] bg-white flex items-center justify-center text-slate-200 shadow-inner border border-slate-100 relative z-10 group-hover:scale-110 transition-transform duration-700">
                       <ArrowRight className="w-14 h-14 group-hover:rotate-180 transition-transform duration-700" />
                    </div>
                 </div>
                 <div className="space-y-4 relative z-10">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">يرجى اختيار مسار دراسي</h3>
                    <p className="text-slate-400 font-medium max-w-sm mx-auto leading-relaxed">قم باختيار منهج من القائمة لاستعراض مواده التعليمية وإدارة الفصول التابعة له.</p>
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* Modals - Simplified logic using mutations */}
        <Dialog open={showAddCurriculum} onOpenChange={setShowAddCurriculum}>
          <DialogContent className="max-w-md rounded-[40px] p-10 text-right">
            <DialogHeader className="text-right">
              <DialogTitle className="text-2xl font-black text-slate-900">إنشاء منهج جديد</DialogTitle>
              <DialogDescription className="text-sm font-bold text-slate-400">تحديد اسم وحالة المنهج الجديد.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddCurriculum} className="mt-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">اسم المنهج</label>
                <Input value={newCurriculum.name} onChange={e => setNewCurriculum({...newCurriculum, name: e.target.value})} className="h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg" required />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">الحالة</label>
                <select value={newCurriculum.status} onChange={e => setNewCurriculum({...newCurriculum, status: e.target.value as 'active' | 'inactive'})} className="w-full h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg appearance-none">
                  <option value="active">نشط</option>
                  <option value="inactive">غير نشط</option>
                </select>
              </div>
              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={upsertCurriculumMutation.isPending} className="flex-1 h-14 rounded-2xl bg-slate-900 text-white font-black text-lg">
                  {upsertCurriculumMutation.isPending ? 'جاري الحفظ...' : 'إنشاء المنهج'}
                </Button>
                <Button type="button" onClick={() => setShowAddCurriculum(false)} variant="ghost" className="h-14 px-8 rounded-2xl bg-slate-50 text-slate-400 font-bold">إلغاء</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editingCurriculum} onOpenChange={() => setEditingCurriculum(null)}>
          <DialogContent className="max-w-md rounded-[40px] p-10 text-right">
            <DialogHeader className="text-right">
              <DialogTitle className="text-2xl font-black text-slate-900">تعديل المنهج</DialogTitle>
              <DialogDescription className="text-sm font-bold text-slate-400">تعديل البيانات الأساسية للمسار التعليمي.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditCurriculum} className="mt-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">اسم المنهج</label>
                <Input value={editingCurriculum?.name || ''} onChange={e => setEditingCurriculum({...editingCurriculum!, name: e.target.value})} className="h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg" required />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">الحالة</label>
                <select value={editingCurriculum?.status || 'active'} onChange={e => setEditingCurriculum({...editingCurriculum!, status: e.target.value as 'active' | 'inactive'})} className="w-full h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg appearance-none">
                  <option value="active">نشط</option>
                  <option value="inactive">غير نشط</option>
                </select>
              </div>
              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={upsertCurriculumMutation.isPending} className="flex-1 h-14 rounded-2xl bg-slate-900 text-white font-black text-lg">حفظ التغييرات</Button>
                <Button type="button" onClick={() => setEditingCurriculum(null)} variant="ghost" className="h-14 px-8 rounded-2xl bg-slate-50 text-slate-400 font-bold">إلغاء</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={showAddSubject} onOpenChange={setShowAddSubject}>
          <DialogContent className="max-w-md rounded-[40px] p-10 text-right">
            <DialogHeader className="text-right">
              <DialogTitle className="text-2xl font-black text-slate-900">إضافة مادة تعليمية</DialogTitle>
              <DialogDescription className="text-sm font-bold text-slate-400">أدخل تفاصيل المادة الجديدة للمنهج.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddSubjectToCurriculum} className="mt-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">اسم المادة</label>
                <Input placeholder="مثال: لغتي الجميلة" value={newSubject.subject_name} onChange={e => setNewSubject({...newSubject, subject_name: e.target.value})} className="h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg" required />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">المحتوى التعليمي</label>
                <Textarea value={newSubject.content} onChange={e => setNewSubject({...newSubject, content: e.target.value})} className="min-h-[120px] px-6 py-4 rounded-2xl bg-slate-50 border-none text-base font-bold resize-none" />
              </div>
              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={upsertSubjectMutation.isPending} className="flex-1 h-14 rounded-2xl bg-indigo-600 text-white font-black text-lg">إضافة المادة</Button>
                <Button type="button" onClick={() => setShowAddSubject(false)} variant="ghost" className="h-14 px-8 rounded-2xl bg-slate-50 text-slate-400 font-bold">إلغاء</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editingSubject} onOpenChange={() => setEditingSubject(null)}>
          <DialogContent className="max-w-md rounded-[40px] p-10 text-right">
            <DialogHeader className="text-right">
              <DialogTitle className="text-2xl font-black text-slate-900">تعديل المادة</DialogTitle>
              <DialogDescription className="text-sm font-bold text-slate-400">تحديث بيانات المادة الدراسية.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditCurriculumSubject} className="mt-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">اسم المادة</label>
                <Input value={editingSubject?.subject_name || ''} onChange={e => setEditingSubject({...editingSubject!, subject_name: e.target.value})} className="h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg" required />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">المحتوى التعليمي</label>
                <Textarea value={editingSubject?.content || ''} onChange={e => setEditingSubject({...editingSubject!, content: e.target.value})} className="min-h-[120px] px-6 py-4 rounded-2xl bg-slate-50 border-none text-base font-bold resize-none" />
              </div>
              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={upsertSubjectMutation.isPending} className="flex-1 h-14 rounded-2xl bg-indigo-600 text-white font-black text-lg">حفظ التعديلات</Button>
                <Button type="button" onClick={() => setEditingSubject(null)} variant="ghost" className="h-14 px-8 rounded-2xl bg-slate-50 text-slate-400 font-bold">إلغاء</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!assignClassCurriculum} onOpenChange={() => setAssignClassCurriculum(null)}>
          <DialogContent className="max-w-md rounded-[40px] p-10 text-right">
            <DialogHeader className="text-right">
              <DialogTitle className="text-2xl font-black text-slate-900">ربط المسار التعليمي</DialogTitle>
              <DialogDescription className="text-sm font-bold text-slate-400">الفصل: {assignClassCurriculum?.name}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAssignCurriculumToClass} className="mt-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">المناهج المتاحة</label>
                <select value={selectedCurriculumForClass || ''} onChange={e => setSelectedCurriculumForClass(e.target.value || null)} className="w-full h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg appearance-none">
                  <option value="">إلغاء الربط الحالي</option>
                  {curriculums.map(curr => <option key={curr.id} value={curr.id}>{curr.name}</option>)}
                </select>
              </div>
              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={assignCurriculumMutation.isPending} className="flex-1 h-14 rounded-2xl bg-slate-900 text-white font-black text-lg">تثبيت الربط</Button>
                <Button type="button" onClick={() => setAssignClassCurriculum(null)} variant="ghost" className="h-14 px-8 rounded-2xl bg-slate-50 text-slate-400 font-bold">إلغاء</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
