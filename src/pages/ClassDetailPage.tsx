import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowRight, School, Users, Edit2, Trash2, 
  User, ChevronLeft, Calendar, Shield, Activity, 
  Search, Loader2, Printer, BookOpen, Plus, Edit3, Layers
} from 'lucide-react';
import { EditClassModal } from './ClassesPage';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { 
  useClass, 
  useClassStudents, 
  useTeachers,
  useDeleteClass,
  useCurriculums,
  useCurriculumSubjects,
  useUpsertCurriculum,
  useDeleteCurriculum,
  useUpsertSubject,
  useDeleteSubject,
  useAssignCurriculumToClass
} from '@/hooks/queries';
import { QueryStateHandler } from '@/components/QueryStateHandler';

export default function ClassDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  
  const [showEdit, setShowEdit] = useState(false);
  const [search, setSearch] = useState('');

  // ── Curriculum Management State ──
  const [showAddCurriculum, setShowAddCurriculum] = useState(false);
  const [newCurriculum, setNewCurriculum] = useState({ name: '', status: 'active' as 'active' | 'inactive' });
  const [editingCurriculum, setEditingCurriculum] = useState<any | null>(null);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubject, setNewSubject] = useState({ subject_name: '', content: '' });
  const [editingSubject, setEditingSubject] = useState<any | null>(null);
  const [selectedCurriculumForClass, setSelectedCurriculumForClass] = useState<string | null>(null);
  const [searchCurriculum, setSearchCurriculum] = useState('');

  // ── Queries ──
  const { data: classItem, isLoading: classLoading, error: classError, refetch: refetchClass } = useClass(id);
  const { data: students = [], isLoading: studentsLoading } = useClassStudents(id);
  const { data: allTeachers = [], isLoading: teachersLoading } = useTeachers();
  
  // Curriculum queries
  const { data: curriculums = [], isLoading: curriculumsLoading, error: curriculumsError, refetch: refetchCurriculums } = useCurriculums();
  const { data: curriculumSubjects = [], isLoading: subjectsLoading, error: subjectsError, refetch: refetchSubjects } = useCurriculumSubjects(classItem?.curriculum_id || null);

  // ── Mutations ──
  const deleteClassMutation = useDeleteClass();
  const upsertCurriculumMutation = useUpsertCurriculum();
  const deleteCurriculumMutation = useDeleteCurriculum();
  const upsertSubjectMutation = useUpsertSubject();
  const deleteSubjectMutation = useDeleteSubject();
  const assignCurriculumMutation = useAssignCurriculumToClass();

  const teacher = useMemo(() => {
    const teachersArray: any[] = Array.isArray(allTeachers) ? allTeachers : (allTeachers as any)?.data || [];
    return teachersArray.find((t: any) => t.id === classItem?.teacher_id);
  }, [allTeachers, classItem?.teacher_id]);

  const filteredStudents = useMemo(() => 
    students.filter(s => s.name.toLowerCase().includes(search.toLowerCase())),
    [students, search]
  );

  const handleDelete = async () => {
    if (!id || !confirm('هل أنت متأكد من حذف هذا الفصل الدراسي نهائياً؟ سيؤدي هذا لإزالة ارتباط الطلاب به.')) return;
    try {
      await deleteClassMutation.mutateAsync(id);
      toast({ title: 'تم الحذف بنجاح' });
      navigate('/classes');
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  // ── Curriculum Handlers ──
  const handleAddCurriculum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCurriculum.name.trim()) return;
    try {
      const curriculum = await upsertCurriculumMutation.mutateAsync({
        name: newCurriculum.name.trim(),
        status: newCurriculum.status,
      });
      // Assign the new curriculum to this class
      await assignCurriculumMutation.mutateAsync({
        classId: id!,
        curriculumId: curriculum.id,
      });
      setShowAddCurriculum(false);
      setNewCurriculum({ name: '', status: 'active' });
      toast({ title: 'تم إضافة المنهج وربطه بالفصل بنجاح' });
      refetchClass();
      refetchCurriculums();
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
      refetchCurriculums();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteCurriculum = async (curriculumId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المنهج؟ سيتم إلغاء ربطه من الفصل.')) return;
    try {
      await deleteCurriculumMutation.mutateAsync(curriculumId);
      // Unlink from class
      await assignCurriculumMutation.mutateAsync({
        classId: id!,
        curriculumId: null,
      });
      toast({ title: 'تم حذف المنهج بنجاح' });
      refetchClass();
      refetchCurriculums();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classItem?.curriculum_id || !newSubject.subject_name.trim()) return;
    try {
      await upsertSubjectMutation.mutateAsync({
        curriculum_id: classItem.curriculum_id,
        subject_name: newSubject.subject_name.trim(),
        content: newSubject.content.trim() || null,
      });
      setShowAddSubject(false);
      setNewSubject({ subject_name: '', content: '' });
      toast({ title: 'تم إضافة المادة بنجاح' });
      refetchSubjects();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleEditSubject = async (e: React.FormEvent) => {
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
      refetchSubjects();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

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

  const handleChangeCurriculum = async (curriculumId: string | null) => {
    try {
      await assignCurriculumMutation.mutateAsync({
        classId: id!,
        curriculumId,
      });
      toast({ title: curriculumId ? 'تم تغيير المنهج بنجاح' : 'تم إلغاء ربط المنهج' });
      refetchClass();
      refetchSubjects();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const isLoadingTotal = classLoading || studentsLoading || teachersLoading;

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 md:gap-8 lg:gap-10 max-w-[1400px] mx-auto text-right pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700 px-3 md:px-0" dir="rtl">
        
        <QueryStateHandler
          loading={classLoading}
          error={classError}
          data={classItem}
          onRetry={refetchClass}
          loadingMessage="جاري مزامنة سجل الفصل الدراسي..."
        >
          {/* Ultra-Premium Hero Banner */}
          <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 border-[0.5px] border-white/10 shadow-2xl p-10 md:p-14 rounded-[40px] md:rounded-[56px] relative overflow-hidden group">
            {/* Ambient Animated Glows */}
            <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-indigo-500/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none mix-blend-screen" />
            <div className="absolute bottom-0 left-0 w-[30rem] h-[30rem] bg-emerald-500/10 rounded-full blur-[80px] translate-y-1/3 -translate-x-1/3 pointer-events-none mix-blend-screen" />
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none mix-blend-overlay" />
            
            <div className="flex items-start lg:items-center gap-6 md:gap-8 relative z-10 w-full lg:w-2/3">
              <button 
                onClick={() => navigate('/classes')}
                className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-xl shrink-0 backdrop-blur-md"
              >
                 <ArrowRight className="w-5 h-5 md:w-7 md:h-7" />
              </button>
              
              <div className="flex items-center gap-5 md:gap-8 min-w-0">
                 <div className="w-16 h-16 md:w-24 md:h-24 rounded-[28px] md:rounded-[40px] bg-gradient-to-tr from-indigo-500 to-emerald-400 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:rotate-[5deg] group-hover:scale-105 transition-all duration-700 shrink-0 border border-white/20">
                    <School className="w-8 h-8 md:w-12 md:h-12 drop-shadow-md" />
                 </div>
                 <div className="space-y-2 min-w-0">
                    <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter drop-shadow-sm mb-1 truncate">{classItem?.name}</h1>
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge className="bg-white/10 text-white border border-white/10 font-bold text-[10px] md:text-xs uppercase tracking-widest px-4 py-1.5 md:px-5 md:py-2 rounded-2xl backdrop-blur-md shadow-sm">
                         {classItem?.grade_level || 'المرحلة الأكاديمية'}
                      </Badge>
                      <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-[10px] md:text-xs uppercase tracking-widest px-4 py-1.5 md:px-5 md:py-2 rounded-2xl backdrop-blur-md">
                         السنة الأكاديمية الجارية
                      </Badge>
                    </div>
                 </div>
              </div>
            </div>
            
            {currentUser?.role === 'admin' && (
              <div className="flex items-center gap-4 md:gap-5 relative z-10 w-full lg:w-auto lg:justify-end mt-6 lg:mt-0">
                <Button 
                  onClick={() => setShowEdit(true)}
                  className="h-14 md:h-16 px-8 rounded-2xl md:rounded-[24px] bg-white text-slate-900 font-black hover:bg-slate-50 transition-all shadow-xl shadow-white/5 gap-3 text-xs md:text-sm"
                >
                  <Edit2 className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" /> تعديل إعدادات الفصل
                </Button>
                <Button 
                  onClick={handleDelete}
                  disabled={deleteClassMutation.isPending}
                  className="h-14 md:h-16 w-14 md:w-16 rounded-2xl md:rounded-[24px] bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-all shadow-lg flex items-center justify-center shrink-0 backdrop-blur-md"
                >
                  {deleteClassMutation.isPending ? <Loader2 className="w-6 h-6 md:w-7 md:h-7 animate-spin" /> : <Trash2 className="w-6 h-6 md:w-7 md:h-7" />}
                </Button>
              </div>
            )}
          </header>

          {/* Interactive Bento Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-8 pt-4">
             <div className="md:col-span-2 bg-gradient-to-tr from-indigo-600 to-indigo-500 p-8 md:p-10 rounded-[48px] text-white flex flex-col justify-between shadow-2xl shadow-indigo-600/30 overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none mix-blend-overlay" />
                <div className="flex items-start justify-between relative z-10 mb-10">
                   <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                      <Users className="w-7 h-7 text-white" />
                   </div>
                   <Badge className="bg-white text-indigo-600 font-bold uppercase tracking-widest text-[9px] border-none shadow-sm shadow-black/5 px-4">تفاعلي</Badge>
                </div>
                <div className="relative z-10">
                   <p className="text-[11px] font-black uppercase tracking-[0.2em] mb-2 text-indigo-100">إجمالي طلاب الفصل</p>
                   <div className="flex items-end gap-3">
                      <h2 className="text-6xl md:text-7xl font-black tracking-tighter drop-shadow-md">{students.length}</h2>
                      <span className="text-sm font-bold text-indigo-200 mb-3 block border-r border-indigo-400/30 pr-3">طالب<br/>مقيد</span>
                   </div>
                </div>
             </div>

             <div className="md:col-span-2 bg-white border border-slate-100 p-8 md:p-10 rounded-[48px] flex flex-col justify-between shadow-xl shadow-slate-200/20 group hover:border-indigo-100 transition-colors relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-start justify-between relative z-10 mb-8">
                   <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center group-hover:rotate-6 transition-transform shadow-sm">
                      <User className="w-7 h-7 text-emerald-600" />
                   </div>
                   <div className="flex items-center gap-1 -space-x-3 -space-x-reverse">
                      <div className="w-8 h-8 rounded-full bg-slate-900 border-2 border-white flex items-center justify-center text-[10px] text-white font-bold truncate z-20" title={teacher?.full_name}>
                        {teacher?.full_name?.charAt(0) || '?'}
                      </div>
                      <button className="w-8 h-8 rounded-full bg-indigo-50 border-2 border-white flex items-center justify-center text-indigo-600 hover:scale-110 transition-all z-10" title="إضافة معلم مساعد">
                         <Plus className="w-3 h-3" />
                      </button>
                   </div>
                </div>
                <div className="relative z-10">
                   <p className="text-[11px] font-black uppercase tracking-[0.2em] mb-2 text-slate-400">هيئة التدريس</p>
                   <div className="flex items-end gap-3">
                      <h2 className="text-2xl md:text-3xl font-black text-slate-900 truncate leading-tight w-full max-w-[200px]">{teacher?.full_name || 'غير محدد'}</h2>
                   </div>
                   <p className="text-xs font-bold text-indigo-600 mt-2 cursor-pointer hover:underline">المعلم الرئيسي للفصل • إدارة الكوادر</p>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 lg:gap-10">
            <div className="lg:col-span-8 space-y-6 md:space-y-8 lg:space-y-10">
                <section className="bg-white border border-slate-50 p-6 md:p-10 rounded-[32px] md:rounded-[48px] lg:rounded-[56px] shadow-xl shadow-slate-100/50 space-y-6 md:space-y-8 lg:space-y-10">
                   <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 md:gap-6 border-b border-slate-50 pb-6 md:pb-8">
                      <div className="flex items-center gap-3 md:gap-4">
                         <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl md:rounded-32 bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner shrink-0">
                            <Users className="w-6 h-6 md:w-7 md:h-7" />
                         </div>
                         <div>
                            <h2 className="text-lg md:text-2xl font-black text-slate-900 mb-0.5 md:mb-1">قائمة طلاب الفصل</h2>
                            <p className="text-[8px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none">إجمالي المقيدين: {students.length} شخص</p>
                         </div>
                      </div>
                      
                      <div className="relative group w-full sm:w-80">
                        <Search className="absolute right-4 md:right-5 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                        <input 
                          type="text" 
                          placeholder="ابحث عن طالب بالاسم..." 
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          className="w-full pr-14 pl-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-[12px] focus:ring-indigo-600/5 transition-all text-sm font-bold placeholder:text-slate-200" 
                        />
                      </div>
                   </header>

                   {filteredStudents.length === 0 ? (
                     <div className="p-24 text-center bg-slate-50 rounded-[48px] border border-dashed border-slate-100">
                        <Users className="w-16 h-16 text-slate-100 mx-auto mb-6" />
                        <p className="text-lg font-black text-slate-400">لم يتم العثور على نتائج</p>
                        <p className="text-xs text-slate-300 font-medium mt-2">جرب البحث بكلمات مختلفة أو تأكد من تسجيل الطلاب</p>
                     </div>
                   ) : (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {filteredStudents.map((s, idx) => (
                          <div 
                            key={s.id} 
                            onClick={() => navigate(`/students/${s.id}`)} 
                            className="p-6 rounded-[32px] bg-white border border-slate-50 hover:border-indigo-100 hover:shadow-2xl hover:shadow-slate-200/50 hover:translate-y-[-4px] transition-all duration-500 group flex items-center justify-between cursor-pointer"
                          >
                            <div className="flex items-center gap-5 min-w-0">
                              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-[11px] font-black text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm shrink-0">
                                {idx + 1}
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors truncate mb-1">{s.name}</h3>
                                <div className="flex items-center gap-2">
                                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                   <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">طالب منتظم</p>
                                </div>
                              </div>
                            </div>
                            <ChevronLeft className="w-5 h-5 text-slate-100 group-hover:text-indigo-600 transition-all translate-x-2 group-hover:translate-x-0" />
                          </div>
                        ))}
                     </div>
                   )}
                </section>
            </div>

            {/* Sidebar Controls */}
            <div className="lg:col-span-4 space-y-10">
               <section className="bg-slate-900 rounded-[56px] p-10 space-y-10 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none opacity-40" />
                  <div className="flex items-center gap-4 relative z-10">
                     <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white shrink-0">
                        <Shield className="w-6 h-6 border-none" />
                     </div>
                     <h2 className="text-xl font-black text-white leading-none">الحوكمة والتقارير</h2>
                  </div>

                  <div className="space-y-8 relative z-10">
                     <div className="p-8 rounded-[40px] bg-white/5 border border-white/5 space-y-6">
                        <header className="flex justify-between items-center">
                           <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">السعة الاستيعابية</p>
                           <Badge className="bg-indigo-600 text-white border-none font-bold text-[9px] px-3">مستقر</Badge>
                        </header>
                        
                        <div className="space-y-4">
                           <div className="flex justify-between items-end">
                              <span className="text-4xl font-black text-white">{students.length} <span className="text-[11px] font-bold text-white/40 tracking-normal mx-1">طالب</span></span>
                              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">90% ممتلئ</span>
                           </div>
                           <Progress value={90} className="h-2 bg-white/10" />
                        </div>
                     </div>
                     
                     <div className="grid grid-cols-1 gap-4">
                        <div className="p-6 rounded-[32px] bg-white/5 border border-white/5 flex items-center gap-5 hover:bg-white/10 transition-colors cursor-pointer group">
                           <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white group-hover:rotate-6 transition-transform">
                              <Calendar className="w-6 h-6" />
                           </div>
                           <div>
                              <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">الفترة الزمنية</p>
                              <p className="text-[12px] font-bold text-white">العام الدراسي 2024 - 2025</p>
                           </div>
                        </div>
                     </div>

                     <Button className="w-full h-16 rounded-[24px] bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all text-sm shadow-2xl shadow-indigo-900/60 relative z-10 gap-3 group">
                        <Printer className="w-5 h-5 text-indigo-300 group-hover:text-white transition-colors" />
                        تصدير كشف الفصل الذكي
                     </Button>
                  </div>
               </section>
               
               <div className="p-10 rounded-[48px] bg-white border border-slate-50 flex flex-col items-center gap-6 text-center shadow-lg">
                  <div className="w-20 h-20 bg-slate-50 rounded-[32px] border border-slate-100 flex items-center justify-center text-slate-300">
                      <Users className="w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                     <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">تلميح إداري</p>
                     <p className="text-xs font-bold text-slate-500 leading-relaxed italic">يمكنك تعيين أكثر من معلم لنفس الفصل من خلال نظام الصلاحيات المتقدم في قسم إدارة الكوادر.</p>
                  </div>
               </div>
            </div>
          </div>
        </QueryStateHandler>

        {/* Curriculum Management Section */}
        {currentUser?.role === 'admin' && (
          <section className="bg-white/40 backdrop-blur-md p-10 rounded-[48px] border border-white/50 shadow-xl space-y-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-[22px] bg-indigo-600 flex items-center justify-center text-white shadow-xl">
                  <BookOpen className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">إدارة المنهج الدراسي</h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">إنشاء وإدارة المناهج والمواد التعليمية لهذا الفصل</p>
                </div>
              </div>
            </div>

            {/* Curriculum Assignment */}
            <div className="space-y-6">
              <div className="flex items-center justify-between p-8 rounded-[32px] bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-4">
                  <Layers className="w-6 h-6 text-indigo-600" />
                  <div>
                    <p className="text-sm font-black text-slate-900">المنهج الحالي</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {classItem?.curriculum_id ? 'فصل مرتبط بمنهج دراسي' : 'لا يوجد منهج مربوط بالفصل'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {classItem?.curriculum_id ? (
                    <Badge className="bg-emerald-50 text-emerald-600 border-none font-bold text-xs px-4 py-2">
                      مربوط بمنهج
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-200 text-amber-600 bg-amber-50 font-bold text-xs px-4 py-2">
                      غير مربوط
                    </Badge>
                  )}
                  <Button 
                    onClick={() => setShowAddCurriculum(true)}
                    className="h-12 px-6 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all shadow-lg gap-2 text-xs"
                  >
                    <Plus className="w-4 h-4" />
                    {classItem?.curriculum_id ? 'تغيير المنهج' : 'ربط منهج'}
                  </Button>
                </div>
              </div>

              {/* Subjects List */}
              {classItem?.curriculum_id && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-3">
                      <BookOpen className="w-5 h-5 text-indigo-600" />
                      المواد الدراسية
                    </h3>
                    <Button 
                      onClick={() => setShowAddSubject(true)}
                      className="h-11 px-5 rounded-xl bg-slate-900 text-white font-black hover:bg-slate-800 transition-all shadow-md gap-2 text-xs"
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
                    emptyMessage="لا توجد مواد مضافة لهذا المنهج"
                    isEmpty={curriculumSubjects.length === 0}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {curriculumSubjects.map(subject => (
                        <div key={subject.id} className="p-6 rounded-[24px] border border-slate-100 bg-white hover:border-indigo-100 hover:shadow-lg transition-all group">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-4 flex-1">
                              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                                <BookOpen className="w-6 h-6" />
                              </div>
                              <div className="flex-1 space-y-2">
                                <h4 className="text-base font-black text-slate-900">{subject.subject_name}</h4>
                                {subject.content && (
                                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{subject.content}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => setEditingSubject(subject)}
                                className="w-9 h-9 rounded-lg bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteSubject(subject.id)}
                                className="w-9 h-9 rounded-lg bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all flex items-center justify-center"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </QueryStateHandler>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {showEdit && classItem && (
        <EditClassModal 
          classItem={classItem} 
          teachers={allTeachers as any} 
          onClose={() => setShowEdit(false)} 
          onSuccess={() => { setShowEdit(false); refetchClass(); }}
        />
      )}

      {/* Curriculum Modals */}
      <Dialog open={showAddCurriculum} onOpenChange={setShowAddCurriculum}>
        <DialogContent className="max-w-md rounded-[40px] p-10 text-right">
          <DialogHeader className="text-right">
            <DialogTitle className="text-2xl font-black text-slate-900">
              {classItem?.curriculum_id ? 'تغيير المنهج' : 'ربط منهج بالفصل'}
            </DialogTitle>
            <DialogDescription className="text-sm font-bold text-slate-400">
              {classItem?.curriculum_id ? 'اختر منهج جديد لهذا الفصل' : 'أنشئ منهج جديد أو اختر من المناهج الموجودة'}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-8 space-y-6">
            {/* Create New Curriculum */}
            <form onSubmit={handleAddCurriculum} className="space-y-4 pb-6 border-b border-slate-100">
              <p className="text-xs font-black text-slate-500">إنشاء منهج جديد</p>
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
              <Button type="submit" disabled={upsertCurriculumMutation.isPending} className="w-full h-14 rounded-2xl bg-indigo-600 text-white font-black text-lg">
                {upsertCurriculumMutation.isPending ? 'جاري الحفظ...' : 'إنشاء وربط المنهج'}
              </Button>
            </form>

            {/* Or Select Existing */}
            {curriculums.length > 0 && (
              <div className="space-y-4">
                <p className="text-xs font-black text-slate-500">أو اختر منهج موجود</p>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {curriculums.map(curr => (
                    <button
                      key={curr.id}
                      onClick={() => {
                        handleChangeCurriculum(curr.id);
                        setShowAddCurriculum(false);
                      }}
                      className="w-full p-5 rounded-2xl border border-slate-100 bg-white hover:border-indigo-200 hover:bg-indigo-50 transition-all text-right"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <BookOpen className="w-5 h-5 text-indigo-600" />
                          <span className="font-black text-slate-900">{curr.name}</span>
                        </div>
                        <Badge variant={curr.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                          {curr.status === 'active' ? 'نشط' : 'غير نشط'}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Unlink Current */}
            {classItem?.curriculum_id && (
              <Button 
                onClick={() => {
                  handleChangeCurriculum(null);
                  setShowAddCurriculum(false);
                }}
                variant="outline" 
                className="w-full h-14 rounded-2xl border-rose-200 text-rose-600 hover:bg-rose-50 font-black"
              >
                إلغاء ربط المنهج الحالي
              </Button>
            )}

            <Button onClick={() => setShowAddCurriculum(false)} variant="ghost" className="w-full h-14 rounded-2xl bg-slate-50 text-slate-400 font-bold">إلغاء</Button>
          </div>
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
          <form onSubmit={handleAddSubject} className="mt-8 space-y-6">
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
          <form onSubmit={handleEditSubject} className="mt-8 space-y-6">
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
    </AppLayout>
  );
}

function StatsCard({ title, value, sub, icon: Icon, color, smallValue }: any) {
  const configs: any = {
    indigo: "bg-slate-900 text-white border-slate-900 shadow-2xl shadow-slate-200",
    emerald: "bg-white text-slate-900 border-slate-50 shadow-xl shadow-slate-100",
    amber: "bg-indigo-600 text-white border-indigo-600 shadow-2xl shadow-indigo-100",
  };
  
  const iconConfigs: any = {
    indigo: "bg-white/10 text-white",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-white/20 text-white",
  };

  return (
    <div className={cn("premium-card p-10 flex flex-col justify-between border-[0.5px] h-60 rounded-[48px] transition-all hover:scale-[1.03] duration-500", configs[color])}>
       <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm", iconConfigs[color])}>
          <Icon className="w-7 h-7" />
       </div>
       <div className="mt-8">
          <p className={cn("text-[10px] font-black uppercase tracking-[0.3em] mb-2 opacity-60", color === 'emerald' ? "text-slate-400" : "text-white/40")}>{title}</p>
          <div className="flex flex-col">
          <h3 className={cn("text-3xl md:text-5xl tracking-tighter drop-shadow-sm font-black mt-1", smallValue ? "text-2xl" : "text-slate-900", color === 'indigo' || color === 'amber' ? "text-white" : "")}>
             {value}
          </h3>
          <p className={cn("text-[10px] font-bold uppercase tracking-widest mt-2", color === 'emerald' ? "text-slate-500" : "text-white/60")}>
             {sub}
          </p>
        </div>
      </div>
    </div>
  );
}
