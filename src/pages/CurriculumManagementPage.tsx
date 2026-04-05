import { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { 
  BookOpen, Plus, Edit3, Trash2, Save, X, Layers, Search, CheckCircle2,
  ArrowRight, ChevronDown, Circle
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

interface Curriculum {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  school_id: string;
}

interface CurriculumSubject {
  id: string;
  curriculum_id: string;
  subject_name: string;
  content: string | null;
}

interface ClassItem {
  id: string;
  name: string;
  curriculum_id: string | null;
}

export default function CurriculumManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCurriculum, setShowAddCurriculum] = useState(false);
  const [newCurriculum, setNewCurriculum] = useState({ name: '', status: 'active' as 'active' | 'inactive' });
  const [editingCurriculum, setEditingCurriculum] = useState<Curriculum | null>(null);
  const [selectedCurriculum, setSelectedCurriculum] = useState<Curriculum | null>(null);
  const [curriculumSubjects, setCurriculumSubjects] = useState<CurriculumSubject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubject, setNewSubject] = useState({ subject_name: '', content: '' });
  const [editingSubject, setEditingSubject] = useState<CurriculumSubject | null>(null);
  const [assignClassCurriculum, setAssignClassCurriculum] = useState<ClassItem | null>(null);
  const [selectedCurriculumForClass, setSelectedCurriculumForClass] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch Curriculums and Classes
  useEffect(() => {
    if (!user?.schoolId) return;
    setLoading(true);
    Promise.all([
      supabase.from('curriculums').select('*').eq('school_id', user.schoolId).order('created_at', { ascending: true }),
      supabase.from('classes').select('id, name, curriculum_id').eq('school_id', user.schoolId).order('name', { ascending: true }),
    ]).then(([{ data: curriculumsData, error: curriculumsError }, { data: classesData, error: classesError }]) => {
      if (curriculumsError) toast({ title: 'خطأ', description: curriculumsError.message, variant: 'destructive' });
      else setCurriculums(curriculumsData || []);

      if (classesError) toast({ title: 'خطأ', description: classesError.message, variant: 'destructive' });
      else setClasses(classesData || []);
      
      setLoading(false);
    });
  }, [user?.schoolId]);

  // Fetch Subjects for selected curriculum
  useEffect(() => {
    if (!selectedCurriculum) {
      setCurriculumSubjects([]);
      return;
    }
    setLoadingSubjects(true);
    supabase.from('curriculum_subjects')
      .select('*')
      .eq('curriculum_id', selectedCurriculum.id)
      .order('subject_name', { ascending: true })
      .then(({ data, error }) => {
        if (error) toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        else setCurriculumSubjects(data || []);
        setLoadingSubjects(false);
      });
  }, [selectedCurriculum]);

  const handleAddCurriculum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCurriculum.name.trim()) return;
    const { data, error } = await supabase.from('curriculums').insert({
      name: newCurriculum.name.trim(),
      status: newCurriculum.status,
      school_id: user?.schoolId,
    }).select().single();

    if (error) toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    else {
      setCurriculums([...curriculums, data]);
      setShowAddCurriculum(false);
      setNewCurriculum({ name: '', status: 'active' });
      toast({ title: 'تم إضافة المنهج بنجاح' });
    }
  };

  const handleEditCurriculum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCurriculum || !editingCurriculum.name.trim()) return;
    const { data, error } = await supabase.from('curriculums').update({
      name: editingCurriculum.name.trim(),
      status: editingCurriculum.status,
    }).eq('id', editingCurriculum.id).select().single();

    if (error) toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    else {
      setCurriculums(curriculums.map(c => c.id === data.id ? data : c));
      setEditingCurriculum(null);
      if (selectedCurriculum?.id === data.id) setSelectedCurriculum(data);
      toast({ title: 'تم تحديث المنهج بنجاح' });
    }
  };

  const handleDeleteCurriculum = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المنهج؟ سيتم إلغاء ربطه بجميع الفصول التابعة له.')) return;
    const { error } = await supabase.from('curriculums').delete().eq('id', id);
    if (error) toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    else {
      setCurriculums(curriculums.filter(c => c.id !== id));
      if (selectedCurriculum?.id === id) setSelectedCurriculum(null);
      // Also update classes that were linked to this curriculum
      setClasses(classes.map(cls => cls.curriculum_id === id ? { ...cls, curriculum_id: null } : cls));
      toast({ title: 'تم حذف المنهج بنجاح' });
    }
  };

  const handleAddSubjectToCurriculum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCurriculum || !newSubject.subject_name.trim()) return;
    const { data, error } = await supabase.from('curriculum_subjects').insert({
      curriculum_id: selectedCurriculum.id,
      subject_name: newSubject.subject_name.trim(),
      content: newSubject.content.trim() || null,
    }).select().single();

    if (error) toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    else {
      setCurriculumSubjects([...curriculumSubjects, data]);
      setShowAddSubject(false);
      setNewSubject({ subject_name: '', content: '' });
      toast({ title: 'تم إضافة المادة للمنهج بنجاح' });
    }
  };

  const handleEditCurriculumSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject || !editingSubject.subject_name.trim()) return;
    const { data, error } = await supabase.from('curriculum_subjects').update({
      subject_name: editingSubject.subject_name.trim(),
      content: editingSubject.content?.trim() || null,
    }).eq('id', editingSubject.id).select().single();

    if (error) toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    else {
      setCurriculumSubjects(curriculumSubjects.map(s => s.id === data.id ? data : s));
      setEditingSubject(null);
      toast({ title: 'تم تحديث المادة بنجاح' });
    }
  };

  const handleDeleteCurriculumSubject = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه المادة من المنهج؟')) return;
    const { error } = await supabase.from('curriculum_subjects').delete().eq('id', id);
    if (error) toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    else {
      setCurriculumSubjects(curriculumSubjects.filter(s => s.id !== id));
      toast({ title: 'تم حذف المادة بنجاح' });
    }
  };

  const handleAssignCurriculumToClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignClassCurriculum) return;

    const { data, error } = await supabase.from('classes').update({
      curriculum_id: selectedCurriculumForClass,
    }).eq('id', assignClassCurriculum.id).select().single();

    if (error) toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    else {
      setClasses(classes.map(cls => cls.id === data.id ? data : cls));
      setAssignClassCurriculum(null);
      setSelectedCurriculumForClass(null);
      toast({ title: 'تم ربط المنهج بالفصل بنجاح' });
    }
  };

  const filteredCurriculums = curriculums.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="flex flex-col gap-10 max-w-[1500px] mx-auto text-right animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 bg-white/40 backdrop-blur-md p-10 sm:p-14 rounded-[56px] border border-white/50 shadow-xl shadow-slate-200/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          <div className="space-y-4 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-[22px] bg-slate-900 flex items-center justify-center text-white shadow-2xl rotate-3 group-hover:rotate-0 transition-all duration-500">
                 <BookOpen className="w-7 h-7" />
              </div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">إدارة المناهج الدراسية</h1>
            </div>
            <p className="text-slate-500 font-medium text-lg pr-1">قم بإنشاء وتخصيص المناهج الدراسية وربطها بالفصول.</p>
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Layers className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-xl font-black text-slate-900">المناهج المتاحة</h2>
                </div>
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
            
            {loading ? (
              <div className="space-y-6">
                {[1, 2, 3].map(i => <div key={i} className="h-28 bg-white rounded-[32px] animate-pulse border border-slate-100" />)}
              </div>
            ) : filteredCurriculums.length === 0 ? (
              <div className="p-20 text-center bg-white rounded-[48px] border border-dashed border-slate-200 shadow-inner">
                <div className="w-20 h-20 rounded-[32px] bg-slate-50 flex items-center justify-center text-slate-200 mx-auto mb-6">
                   <BookOpen className="w-10 h-10" />
                </div>
                <p className="text-slate-400 font-black text-lg">{searchQuery ? 'لا توجد نتائج للبحث' : 'بانتظار إنشاء مناهج'}</p>
                <p className="text-slate-300 text-xs mt-2 font-medium">{searchQuery ? 'جرب كلمات بحث أخرى' : 'ابدأ بإنشاء أول منهج دراسي'}</p>
              </div>
            ) : (
              <div className="space-y-5">
                {filteredCurriculums.map(curriculum => (
                  <div
                    key={curriculum.id}
                    onClick={() => setSelectedCurriculum(curriculum)}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "w-full p-8 rounded-[40px] border-2 transition-all flex items-center justify-between group relative overflow-hidden cursor-pointer",
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
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">
                          الحالة: {curriculum.status === 'active' ? 'نشط' : 'غير نشط'}
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
                      <div className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center transition-all",
                        selectedCurriculum?.id === curriculum.id ? "bg-indigo-50 text-indigo-600" : "bg-slate-50 text-slate-300"
                      )}>
                         <ArrowRight className={cn("w-5 h-5 transition-transform", selectedCurriculum?.id === curriculum.id ? "rotate-180" : "group-hover:translate-x-[-4px]")} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                            <span className={cn("text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full", selectedCurriculum.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600')}>
                              {selectedCurriculum.status === 'active' ? 'نشط' : 'غير نشط'}
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                            <span className="text-slate-400 font-bold text-xs">{curriculumSubjects.length} مواد دراسية</span>
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
                <div className="space-y-10">
                   {loadingSubjects ? (
                     <div className="space-y-4">
                        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-50 rounded-3xl animate-pulse border border-slate-100" />)}
                     </div>
                   ) : curriculumSubjects.length === 0 ? (
                     <div className="p-32 text-center flex flex-col items-center gap-6 bg-slate-50/50 border border-dashed border-slate-200 rounded-[48px] relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="w-24 h-24 rounded-[40px] bg-white flex items-center justify-center text-slate-200 shadow-inner border border-slate-100 relative z-10 group-hover:scale-110 transition-transform">
                           <Layers className="w-12 h-12" />
                        </div>
                        <div className="relative z-10 space-y-2">
                           <p className="text-slate-900 font-black text-xl">لا توجد مواد في هذا المنهج</p>
                           <p className="text-slate-400 font-medium max-w-xs mx-auto leading-relaxed">ابدأ بإضافة المواد التي يتضمنها هذا المنهج.</p>
                        </div>
                     </div>
                   ) : (
                     <div className="grid grid-cols-1 gap-6">
                        {curriculumSubjects.map(subject => (
                          <div key={subject.id} className="p-6 rounded-3xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                <BookOpen className="w-6 h-6" />
                              </div>
                              <div>
                                <p className="text-lg font-bold text-slate-900">{subject.subject_name}</p>
                                <p className="text-xs text-slate-500 mt-1">{subject.content || 'لا يوجد محتوى محدد'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => setEditingSubject(subject)}
                                className="w-9 h-9 rounded-xl bg-white text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center shadow-sm"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteCurriculumSubject(subject.id)}
                                className="w-9 h-9 rounded-xl bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all flex items-center justify-center shadow-sm"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                     </div>
                   )}
                </div>

                {/* Classes linked to this curriculum */}
                <div className="space-y-6 pt-10 border-t border-slate-50">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                      <Layers className="w-5 h-5 text-indigo-600" />
                      الفصول المرتبطة بهذا المنهج
                    </h3>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const availableClasses = classes.filter(cls => !cls.curriculum_id);
                        if (availableClasses.length === 0) {
                          toast({ title: 'تنبيه', description: 'جميع الفصول مرتبطة بمناهج دراسية بالفعل.' });
                          return;
                        }
                        setAssignClassCurriculum(availableClasses[0]);
                        setSelectedCurriculumForClass(selectedCurriculum.id);
                      }}
                      className="rounded-xl border-indigo-100 text-indigo-600 hover:bg-indigo-50 font-black text-[10px] uppercase tracking-widest h-10 px-5"
                    >
                      ربط فصل جديد
                    </Button>
                  </div>
                  
                  {classes.filter(cls => cls.curriculum_id === selectedCurriculum.id).length === 0 ? (
                    <div className="p-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-sm font-bold text-slate-400">لا توجد فصول مرتبطة بهذا المنهج حالياً.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {classes.filter(cls => cls.curriculum_id === selectedCurriculum.id).map(cls => (
                        <div key={cls.id} className="p-4 rounded-xl bg-white border border-slate-100 flex items-center justify-between group/cls">
                          <span className="text-base font-bold text-slate-700">{cls.name}</span>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              if (confirm(`هل أنت متأكد من إلغاء ربط المنهج بالفصل ${cls.name}؟`)) {
                                // Trigger update directly for better UX
                                supabase.from('classes').update({
                                  curriculum_id: null,
                                }).eq('id', cls.id).then(({ error }) => {
                                  if (error) toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
                                  else {
                                    setClasses(classes.map(c => c.id === cls.id ? { ...c, curriculum_id: null } : c));
                                    toast({ title: 'تم إلغاء الربط بنجاح' });
                                  }
                                });
                              }
                            }}
                            className="text-rose-500 hover:bg-rose-50 opacity-0 group-hover/cls:opacity-100 transition-opacity"
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
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">يرجى اختيار منهج دراسي</h3>
                    <p className="text-slate-400 font-medium max-w-sm mx-auto leading-relaxed">قم باختيار منهج من القائمة الجانبية لعرض وإدارة مواده الدراسية وربطه بالفصول.</p>
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* Classes without curriculum - Removed as it's now integrated above */}

        {/* Add Curriculum Modal */}
        <Dialog open={showAddCurriculum} onOpenChange={setShowAddCurriculum}>
          <DialogContent className="max-w-md rounded-[40px] p-10 text-right">
            <DialogHeader className="text-right">
              <DialogTitle className="text-2xl font-black text-slate-900">إنشاء منهج جديد</DialogTitle>
              <DialogDescription className="text-sm font-bold text-slate-400">أدخل تفاصيل المنهج الدراسي الجديد.</DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleAddCurriculum} className="mt-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 mr-2 uppercase tracking-widest">اسم المنهج</label>
                <Input 
                  autoFocus
                  placeholder="مثال: منهج الصف الأول، منهج العلوم..."
                  value={newCurriculum.name} 
                  onChange={e => setNewCurriculum({...newCurriculum, name: e.target.value})}
                  className="h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg focus:bg-white transition-all shadow-inner"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 mr-2 uppercase tracking-widest">الحالة</label>
                <select
                  value={newCurriculum.status}
                  onChange={e => setNewCurriculum({...newCurriculum, status: e.target.value as 'active' | 'inactive'})}
                  className="w-full h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg focus:bg-white transition-all shadow-inner appearance-none"
                >
                  <option value="active">نشط</option>
                  <option value="inactive">غير نشط</option>
                </select>
              </div>
              <div className="flex gap-4 pt-4">
                <Button type="submit" className="flex-1 h-14 rounded-2xl bg-slate-900 text-white font-black text-lg">إنشاء المنهج</Button>
                <Button type="button" onClick={() => setShowAddCurriculum(false)} variant="ghost" className="h-14 px-8 rounded-2xl bg-slate-50 text-slate-400 font-bold">إلغاء</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Curriculum Modal */}
        <Dialog open={!!editingCurriculum} onOpenChange={() => setEditingCurriculum(null)}>
          <DialogContent className="max-w-md rounded-[40px] p-10 text-right">
            <DialogHeader className="text-right">
              <DialogTitle className="text-2xl font-black text-slate-900">تعديل المنهج</DialogTitle>
              <DialogDescription className="text-sm font-bold text-slate-400">تعديل تفاصيل المنهج الدراسي.</DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleEditCurriculum} className="mt-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 mr-2 uppercase tracking-widest">اسم المنهج</label>
                <Input 
                  autoFocus
                  value={editingCurriculum?.name || ''} 
                  onChange={e => setEditingCurriculum({...editingCurriculum!, name: e.target.value})}
                  className="h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg focus:bg-white transition-all shadow-inner"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 mr-2 uppercase tracking-widest">الحالة</label>
                <select
                  value={editingCurriculum?.status || 'active'}
                  onChange={e => setEditingCurriculum({...editingCurriculum!, status: e.target.value as 'active' | 'inactive'})}
                  className="w-full h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg focus:bg-white transition-all shadow-inner appearance-none"
                >
                  <option value="active">نشط</option>
                  <option value="inactive">غير نشط</option>
                </select>
              </div>
              <div className="flex gap-4 pt-4">
                <Button type="submit" className="flex-1 h-14 rounded-2xl bg-slate-900 text-white font-black text-lg">حفظ التغييرات</Button>
                <Button type="button" onClick={() => setEditingCurriculum(null)} variant="ghost" className="h-14 px-8 rounded-2xl bg-slate-50 text-slate-400 font-bold">إلغاء</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Add Subject to Curriculum Modal */}
        <Dialog open={showAddSubject} onOpenChange={setShowAddSubject}>
          <DialogContent className="max-w-md rounded-[40px] p-10 text-right">
            <DialogHeader className="text-right">
              <DialogTitle className="text-2xl font-black text-slate-900">إضافة مادة للمنهج</DialogTitle>
              <DialogDescription className="text-sm font-bold text-slate-400">أدخل تفاصيل المادة الجديدة للمنهج: {selectedCurriculum?.name}</DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleAddSubjectToCurriculum} className="mt-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 mr-2 uppercase tracking-widest">اسم المادة</label>
                <Input 
                  autoFocus
                  placeholder="مثال: الرياضيات، اللغة العربية..."
                  value={newSubject.subject_name} 
                  onChange={e => setNewSubject({...newSubject, subject_name: e.target.value})}
                  className="h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg focus:bg-white transition-all shadow-inner"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 mr-2 uppercase tracking-widest">المحتوى الحالي للمادة</label>
                <Textarea 
                  placeholder="مثال: من سورة الناس إلى المعارج، الوحدة الأولى: الأعداد النسبية..."
                  value={newSubject.content || ''} 
                  onChange={e => setNewSubject({...newSubject, content: e.target.value})}
                  className="min-h-[100px] px-6 py-4 rounded-2xl border-slate-100 bg-slate-50 text-base font-bold leading-relaxed focus:bg-white transition-all resize-none"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <Button type="submit" className="flex-1 h-14 rounded-2xl bg-slate-900 text-white font-black text-lg">إضافة المادة</Button>
                <Button type="button" onClick={() => setShowAddSubject(false)} variant="ghost" className="h-14 px-8 rounded-2xl bg-slate-50 text-slate-400 font-bold">إلغاء</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Curriculum Subject Modal */}
        <Dialog open={!!editingSubject} onOpenChange={() => setEditingSubject(null)}>
          <DialogContent className="max-w-md rounded-[40px] p-10 text-right">
            <DialogHeader className="text-right">
              <DialogTitle className="text-2xl font-black text-slate-900">تعديل مادة المنهج</DialogTitle>
              <DialogDescription className="text-sm font-bold text-slate-400">تعديل تفاصيل المادة في المنهج.</DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleEditCurriculumSubject} className="mt-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 mr-2 uppercase tracking-widest">اسم المادة</label>
                <Input 
                  autoFocus
                  value={editingSubject?.subject_name || ''} 
                  onChange={e => setEditingSubject({...editingSubject!, subject_name: e.target.value})}
                  className="h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg focus:bg-white transition-all shadow-inner"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 mr-2 uppercase tracking-widest">المحتوى الحالي للمادة</label>
                <Textarea 
                  placeholder="مثال: من سورة الناس إلى المعارج، الوحدة الأولى: الأعداد النسبية..."
                  value={editingSubject?.content || ''} 
                  onChange={e => setEditingSubject({...editingSubject!, content: e.target.value})}
                  className="min-h-[100px] px-6 py-4 rounded-2xl border-slate-100 bg-slate-50 text-base font-bold leading-relaxed focus:bg-white transition-all resize-none"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <Button type="submit" className="flex-1 h-14 rounded-2xl bg-slate-900 text-white font-black text-lg">حفظ التغييرات</Button>
                <Button type="button" onClick={() => setEditingSubject(null)} variant="ghost" className="h-14 px-8 rounded-2xl bg-slate-50 text-slate-400 font-bold">إلغاء</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Assign Curriculum to Class Modal */}
        <Dialog open={!!assignClassCurriculum} onOpenChange={() => setAssignClassCurriculum(null)}>
          <DialogContent className="max-w-md rounded-[40px] p-10 text-right">
            <DialogHeader className="text-right">
              <DialogTitle className="text-2xl font-black text-slate-900">ربط منهج بفصل</DialogTitle>
              <DialogDescription className="text-sm font-bold text-slate-400">
                ربط المنهج الدراسي بالفصل: {assignClassCurriculum?.name}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleAssignCurriculumToClass} className="mt-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 mr-2 uppercase tracking-widest">اختر المنهج</label>
                <select
                  value={selectedCurriculumForClass || ''}
                  onChange={e => setSelectedCurriculumForClass(e.target.value || null)}
                  className="w-full h-14 px-6 rounded-2xl bg-slate-50 border-none font-bold text-lg focus:bg-white transition-all shadow-inner appearance-none"
                >
                  <option value="">إلغاء الربط</option>
                  {curriculums.map(curr => (
                    <option key={curr.id} value={curr.id}>{curr.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-4 pt-4">
                <Button type="submit" className="flex-1 h-14 rounded-2xl bg-slate-900 text-white font-black text-lg">حفظ الربط</Button>
                <Button type="button" onClick={() => setAssignClassCurriculum(null)} variant="ghost" className="h-14 px-8 rounded-2xl bg-slate-50 text-slate-400 font-bold">إلغاء</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
