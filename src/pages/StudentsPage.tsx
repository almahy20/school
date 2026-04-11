import { useState, useMemo, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useStudents, useDeleteStudent, useAddStudent, useUpdateStudent, useClasses, useBranding } from '@/hooks/queries';
import DataPagination from '@/components/ui/DataPagination';
import { 
  Plus, Search, GraduationCap, School, User, 
  Eye, Edit2, Edit3, Trash2, Filter, MoreHorizontal,
  ChevronLeft, ArrowRight, BookOpen, Clock, Activity,
  Calendar, CheckCircle, Shield, AlertCircle, RefreshCw,
  Phone, MapPin
} from 'lucide-react';
import { sendPushToUser } from '@/utils/pushNotifications';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import DataDetailModal from '@/components/DataDetailModal';
import { QueryStateHandler } from '@/components/QueryStateHandler';

const PAGE_SIZE = 15;

export default function StudentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // ── Local UI state ──
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('الكل');
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  
  // Detail Modal State
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  // ── React Query Hooks ──
  // نمرر البارامترات للـ hook ليقوم بالفلترة والتجزئة من جهة الخادم
  const { 
    data, 
    isLoading: loading, 
    error, 
    refetch, 
    isRefetching 
  } = useStudents(page, PAGE_SIZE, debouncedSearch, filterClass);
  
  const students = data?.data || [];
  const totalItems = data?.count || 0;

  const { data: branding } = useBranding();
  const { data: classesData } = useClasses();
  const classes: Array<{id: string; name: string; grade_level: string | null}> = classesData?.data || [];
  const deleteMutation = useDeleteStudent();

  // ── Debounce Search ──
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Derive classes list for filter dropdown (نستخدم قائمة الفصول الفعلية بدلاً من استنتاجها من الطلاب)
  const availableClasses = useMemo(() => {
    if (!classes || !Array.isArray(classes)) return ['الكل'];
    return [
      'الكل',
      ...classes.map(c => c.name)
    ];
  }, [classes]);

  const handleFilterChange = (val: string) => { 
    setFilterClass(val); 
    setPage(1); 
  };

  const handleSearch = (val: string) => { 
    setSearch(val); 
    setPage(1); 
  };

  const handleShowDetail = (student: any) => {
    navigate(`/students/${student.id}`);
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الطالب؟')) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: 'تم الحذف', description: 'تم حذف الطالب بنجاح' });
      setShowDetail(false);
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message || 'فشل في حذف الطالب', variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 md:gap-10 animate-in fade-in slide-in-from-bottom-4 duration-1000 max-w-[1500px] mx-auto text-right pb-14 px-2 md:px-0">
        {/* Premium Header - Dynamic & Modern */}
        <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-white/40 backdrop-blur-md p-6 sm:p-8 rounded-3xl border border-white/50 shadow-xl shadow-slate-200/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          <div className="space-y-4 relative z-10">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-2xl rotate-3 group-hover:rotate-0 transition-all duration-500">
                  <GraduationCap className="w-6 h-6" />
               </div>
               <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">إدارة شؤون الطلاب</h1>
            </div>
            <p className="text-slate-500 font-medium text-base pr-1">قاعدة البيانات المركزية، السجلات الأكاديمية، ونتائج المتابعة الشاملة.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 relative z-10">
             {user?.role === 'admin' && (
               <Button 
                 onClick={() => setShowAdd(true)} 
                 className="h-12 px-8 rounded-xl bg-indigo-600 text-white font-bold hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-200 gap-2"
               >
                 <Plus className="w-5 h-5" /> إضافة طالب جديد
               </Button>
             )}
          </div>
        </header>

        {/* Filters and Search - Premium Scaling */}
        <div className="flex flex-col lg:flex-row gap-6 items-center">
          <div className="relative group flex-1 w-full">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 to-violet-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
            <div className="relative">
              <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              <Input 
                placeholder="ابحث عن اسم الطالب..." 
                value={search}
                onChange={e => handleSearch(e.target.value)}
                className="h-12 pr-12 pl-6 rounded-xl border-none bg-white text-sm font-bold shadow-md shadow-slate-200/50 transition-all focus:ring-0 placeholder:text-slate-300"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3 overflow-x-auto pb-4 no-scrollbar lg:w-auto w-full px-2">
            {availableClasses.map(cls => (
              <button 
                key={cls} 
                onClick={() => handleFilterChange(cls)}
                className={cn(
                  "px-6 py-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all border-2 shadow-sm shrink-0",
                  filterClass === cls
                    ? "bg-slate-900 border-slate-900 text-white shadow-lg scale-105"
                    : "bg-white border-transparent text-slate-500 hover:border-slate-100 hover:text-indigo-600"
                )}>
                {cls === 'الكل' ? 'جميع الفصول' : `فصل ${cls}`}
              </button>
            ))}
          </div>
        </div>

        <QueryStateHandler
          loading={loading}
          error={error}
          data={students}
          onRetry={refetch}
          isRefetching={isRefetching}
          loadingMessage="جاري مزامنة بيانات الطلاب..."
          errorMessage="فشل تحميل قائمة الطلاب. يرجى التحقق من اتصالك بالإنترنت."
          emptyMessage="لا يوجد طلاب مسجلين حالياً في المدرسة."
          isEmpty={students.length === 0}
        >
          <div className="space-y-10">
            <div className="flex items-center justify-between px-6">
              <div className="flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                   {totalItems} سجل مكتشف في النظام
                 </span>
              </div>
              <Badge className="bg-slate-100 text-slate-400 font-black text-[9px] uppercase tracking-widest px-4 py-1.5">الصفحة {page}</Badge>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {students.map(s => (
                <StudentCard key={s.id} student={s as any} onClick={() => handleShowDetail(s)} />
              ))}
            </div>
            
            <div className="pt-10">
              <DataPagination
                currentPage={page}
                totalItems={totalItems}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          </div>
        </QueryStateHandler>
      </div>

      {selectedStudent && (
        <DataDetailModal
          isOpen={showDetail}
          onClose={() => setShowDetail(false)}
          title={selectedStudent.name}
          subtitle={`طالب في فصل ${selectedStudent.classes?.name || 'غير محدد'}`}
          icon={GraduationCap}
          badge={{ label: selectedStudent.classes?.grade_level || 'عام', variant: 'outline' }}
          data={[
            { label: 'الاسم الكامل', value: selectedStudent.name, icon: User, fullWidth: true },
            { label: 'الفصل الدراسي', value: selectedStudent.classes?.name || 'غير محدد', icon: School },
            { label: 'المرحلة الدراسية', value: selectedStudent.classes?.grade_level || 'غير محدد', icon: BookOpen },
            { label: 'تاريخ التسجيل', value: selectedStudent.created_at ? new Date(selectedStudent.created_at).toLocaleDateString('ar-EG') : 'غير متوفر', icon: Calendar },
            { label: 'رقم الهاتف (ولي الأمر)', value: selectedStudent.parent_phone || 'لا يوجد', icon: Phone },
            { label: 'العنوان', value: selectedStudent.address || 'غير مسجل', icon: MapPin, fullWidth: true },
          ]}
          actions={user?.role === 'admin' ? [
            { label: 'عرض السجل الأكاديمي', icon: Activity, onClick: () => navigate(`/students/${selectedStudent.id}`) },
            { label: 'تعديل البيانات', icon: Edit3, onClick: () => { setShowDetail(false); setShowEdit(true); } },
            { label: 'حذف السجل', icon: Trash2, variant: 'destructive', onClick: () => handleDeleteStudent(selectedStudent.id) }
          ] : [
            { label: 'عرض السجل الأكاديمي', icon: Activity, onClick: () => navigate(`/students/${selectedStudent.id}`) }
          ]}
        />
      )}

      {showEdit && selectedStudent && (
        <EditStudentModal
          student={selectedStudent}
          classes={classes}
          user={user}
          onClose={() => setShowEdit(false)}
          onSuccess={() => {
            setShowEdit(false);
            setSelectedStudent(null);
          }}
        />
      )}

      {showAdd && (
        <AddStudentModal 
          classes={classes} 
          user={user} 
          onClose={() => setShowAdd(false)} 
          onSuccess={() => setShowAdd(false)} 
        />
      )}
    </AppLayout>
  );
}

function StudentCard({ student, onClick }: { student: any; onClick: () => void }) {
  return (
    <div className="group premium-card p-0 overflow-hidden hover:translate-y-[-4px] transition-all duration-500 text-right cursor-pointer" onClick={onClick}>
      <div className="p-6 space-y-6">
         <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-[18px] bg-indigo-50 flex items-center justify-center text-indigo-600 transition-all group-hover:bg-slate-900 group-hover:text-white group-hover:rotate-6 shadow-inner">
               <User className="w-6 h-6" />
            </div>
            <Badge variant="outline" className="rounded-lg px-3 py-1 bg-slate-50 border-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-400">
               {student.classes?.grade_level || 'غير محدد'}
            </Badge>
         </div>

         <div>
            <h3 className="text-lg font-black text-slate-900 mb-1.5 group-hover:text-indigo-600 transition-colors leading-tight">{student.name}</h3>
            <div className="flex items-center gap-2 text-slate-400">
               <School className="w-3.5 h-3.5" />
               <span className="text-[10px] font-black tracking-tight">{student.classes?.name || 'بدون فصل'}</span>
            </div>
         </div>

         <div className="flex items-center justify-between pt-4 border-t border-slate-50">
            <div className="flex flex-col">
               <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">الحالة</span>
               <span className="text-[10px] font-black text-emerald-600">منتظم</span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-all">
               <ArrowRight className="w-4 h-4" />
            </div>
         </div>
      </div>
    </div>
  );
}

// ─── Add Student Modal ────────────────────────────────────────────────────────
function AddStudentModal({ classes, user, onClose, onSuccess }: any) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [classId, setClassId] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const addMutation = useAddStudent();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    try {
      const normalizedPhone = parentPhone.replace(/\D/g, '');
      await addMutation.mutateAsync({
        name: name.trim(),
        class_id: classId || null,
        parent_phone: normalizedPhone || null,
        school_id: user?.schoolId
      });
      toast({ title: 'تمت الإضافة بنجاح' });
      onSuccess();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message || 'فشل في إضافة الطالب', variant: 'destructive' });
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-right animate-in fade-in" onClick={onClose}>
      <div className="bg-white border border-slate-100 shadow-2xl w-full max-w-lg p-10 rounded-[40px] animate-in zoom-in-95 relative overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-bl-[100px]" />
        <h2 className="text-2xl font-black text-slate-900 mb-10 tracking-tight relative z-10">إضافة طالب جديد</h2>
        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">اسم الطالب بالكامل *</label>
            <Input value={name} onChange={e => setName(e.target.value)} required
              className="h-14 px-6 rounded-2xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-primary/10 font-bold text-sm shadow-inner transition-all" placeholder="مثال: أحمد محمد علي" />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">الفصل الدراسي</label>
              <select value={classId} onChange={e => setClassId(e.target.value)}
                className="w-full h-14 px-6 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all font-bold text-sm appearance-none shadow-inner">
                <option value="">بدون فصل</option>
                {classes.map((cls: any) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">رقم هاتف ولي الأمر</label>
              <Input value={parentPhone} onChange={e => setParentPhone(e.target.value)}
                className="h-14 px-6 rounded-2xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all font-bold text-sm shadow-inner"
                placeholder="05xxxxxxxx" dir="ltr" />
            </div>
          </div>
          <div className="flex gap-4 pt-6">
            <Button type="submit" disabled={addMutation.isPending}
              className="flex-[2] h-14 rounded-2xl bg-slate-900 text-white font-black shadow-xl hover:bg-primary transition-all text-sm">
              {addMutation.isPending ? 'جاري الحفظ...' : 'تأكيد الحفظ'}
            </Button>
            <Button type="button" onClick={onClose} variant="ghost"
              className="flex-1 h-14 rounded-2xl bg-slate-50 text-slate-500 font-black text-sm">إلغاء</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EditStudentModal({ student, classes, user, onClose, onSuccess }: any) {
    const { toast } = useToast();
    const [name, setName] = useState(student.name);
    const [classId, setClassId] = useState(student.class_id || '');
    const [parentPhone, setParentPhone] = useState(student.parent_phone || '');
    const updateMutation = useUpdateStudent();
  
    const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) return;
      
      try {
        const normalizedPhone = (parentPhone || '').replace(/\D/g, '');
        await updateMutation.mutateAsync({ 
          id: student.id,
          name: name.trim(), 
          class_id: classId || null,
          parent_phone: normalizedPhone || null
        });

        toast({ title: 'تم التحديث بنجاح' });
        onSuccess();
      } catch (err: any) {
        toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
      }
    };
  
    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-right animate-in fade-in" onClick={onClose}>
        <div className="bg-white border border-slate-100 shadow-2xl w-full max-w-lg p-10 rounded-[40px] animate-in zoom-in-95 relative overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-bl-[100px]" />
          <h2 className="text-2xl font-black text-slate-900 mb-10 tracking-tight relative z-10">تعديل بيانات الطالب</h2>
          <form onSubmit={handleSave} className="space-y-6 relative z-10">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">اسم الطالب بالكامل *</label>
              <Input value={name} onChange={e => setName(e.target.value)} required
                className="h-14 px-6 rounded-2xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-primary/10 font-bold text-sm shadow-inner" />
            </div>
            
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">الفصل الدراسي</label>
                <select value={classId} onChange={e => setClassId(e.target.value)}
                  className="w-full h-14 px-6 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all font-bold text-sm appearance-none shadow-inner">
                  <option value="">بدون فصل</option>
                  {classes.map((cls: any) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">رقم هاتف ولي الأمر</label>
                <Input value={parentPhone} onChange={e => setParentPhone(e.target.value)}
                  className="h-14 px-6 rounded-2xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all font-bold text-sm shadow-inner"
                  placeholder="05xxxxxxxx" dir="ltr" />
              </div>
            </div>

            <div className="flex gap-4 pt-6">
              <Button type="submit" disabled={updateMutation.isPending}
                className="flex-[2] h-14 rounded-2xl bg-slate-900 text-white font-black shadow-xl hover:bg-primary transition-all text-sm">
                {updateMutation.isPending ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </Button>
              <Button type="button" onClick={onClose} variant="ghost"
                className="flex-1 h-14 rounded-2xl bg-slate-50 text-slate-500 font-black text-sm">إلغاء</Button>
            </div>
          </form>
        </div>
      </div>
    );
  }
