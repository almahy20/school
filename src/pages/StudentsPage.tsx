import { useState, useMemo, useEffect, useRef } from 'react';
import { useSessionState } from '@/hooks/useSessionState';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useStudents, useDeleteStudent, useAddStudent, useUpdateStudent, useAllClasses } from '@/hooks/queries';
import DataPagination from '@/components/ui/DataPagination';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Search, GraduationCap, School, User, 
  ArrowRight,
  SlidersHorizontal, Check, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { QueryStateHandler } from '@/components/QueryStateHandler';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/layout/PageHeader';

const PAGE_SIZE = 15;

// ── Skeleton لشبكة الطلاب (يُعرض بدل الـ spinner في أول تحميل) ───────────────
function StudentsGridSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 px-1">
        <Skeleton className="w-2 h-2 rounded-full" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-[24px] p-5 space-y-4 shadow-sm border border-slate-50">
            <div className="flex items-center gap-3">
              <Skeleton className="w-11 h-11 rounded-2xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="w-16 h-6 rounded-xl" />
            </div>
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-8 flex-1 rounded-xl" />
              <Skeleton className="h-8 flex-1 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-10 w-full rounded-2xl" />
    </div>
  );
}

export default function StudentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // ── Local UI state ── (session-persistent filters)
  const [search, setSearch] = useSessionState('students:search', '');
  const [filterClassId, setFilterClassId] = useSessionState('students:filterClassId', 'الكل');
  const [page, setPage] = useSessionState('students:page', 1);
  // نبدأ debouncedSearch بنفس قيمة search المحفوظة حتى لا يتأخر الفلتر عند العودة للصفحة
  const [debouncedSearch, setDebouncedSearch] = useState(() => {
    try {
      const stored = sessionStorage.getItem('students:search');
      return stored !== null ? JSON.parse(stored) : '';
    } catch { return ''; }
  });
  const [showAdd, setShowAdd] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // ── React Query Hooks ──
  // نمرر البارامترات للـ hook ليقوم بالفلترة والتجزئة من جهة الخادم
  const { 
    data, 
    isLoading: loading, 
    error, 
    refetch, 
    isRefetching 
  } = useStudents(page, PAGE_SIZE, debouncedSearch, filterClassId);
  
  const students = data?.data || [];
  const totalItems = data?.count || 0;

  const { data: classesData } = useAllClasses();
  // Normalize classes to always be an array
  const classes: Array<{id: string; name: string; grade_level: string | null}> = useMemo(() => 
    Array.isArray(classesData) ? classesData : [], [classesData]);
  const deleteMutation = useDeleteStudent();

  // ── Debounce Search ──
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Derive classes list for filter dropdown — بـ classId وليس اسم الفصل
  const availableClasses = useMemo(() => {
    if (!classes || !Array.isArray(classes)) return [];
    return classes.map(c => ({ id: c.id, name: c.name }));
  }, [classes]);

  const handleFilterChange = (val: string) => { 
    setFilterClassId(val); 
    setPage(1);
    setFilterOpen(false); // إغلاق الـ popover فور الاختيار
  };

  const handleSearch = (val: string) => { 
    setSearch(val); 
    setPage(1); 
  };

  // إغلاق الـ popover عند الضغط خارجه
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    if (filterOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [filterOpen]);

  const handleShowDetail = (student: any) => {
    navigate(`/students/${student.id}`);
  };

  const handleDeleteStudent = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: 'تم الحذف', description: 'تم حذف الطالب بنجاح' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message || 'فشل في حذف الطالب', variant: 'destructive' });
    } finally {
      setDeleteTargetId(null);
    }
  };

  return (
    <AppLayout>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1500px] mx-auto text-right pb-14 px-2 md:px-0">
        <PageHeader
          icon={GraduationCap}
          title="إدارة شؤون الطلاب"
          subtitle="قاعدة البيانات المركزية، السجلات الأكاديمية، ونتائج المتابعة الشاملة"
          action={
            user?.role === 'admin' && (
              <Button
                onClick={() => setShowAdd(true)}
                className="h-12 px-8 rounded-2xl bg-indigo-600 text-white font-black hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-200 gap-2"
              >
                <Plus className="w-5 h-5" /> إضافة طالب جديد
              </Button>
            )
          }
        />

        {/* Search + Filter Row */}
        <div className="flex items-center gap-3 mt-6 mb-6">
          <div className="relative group flex-1">
            <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
            <Input
              placeholder="ابحث عن اسم الطالب..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
              className="h-14 pr-14 pl-6 rounded-2xl border-none bg-white text-base font-bold shadow-sm focus:ring-4 focus:ring-indigo-600/5 w-full"
            />
            {search && (
              <button
                onClick={() => handleSearch('')}
                className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 transition-colors text-lg font-bold"
              >×</button>
            )}
          </div>

          {/* Filter Button + Popover */}
          <div className="relative shrink-0" ref={filterRef}>
            <button
              onClick={() => setFilterOpen(v => !v)}
              className={cn(
                "h-14 px-5 rounded-2xl font-black text-sm flex items-center gap-2 transition-all shadow-sm border",
                filterClassId === 'الكل'
                  ? "bg-white border-slate-100 text-slate-500 hover:border-indigo-200 hover:text-indigo-600"
                  : "bg-indigo-600 border-indigo-600 text-white shadow-indigo-200"
              )}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">
                {filterClassId === 'الكل' ? 'تصفية حسب الفصل' : 
                 filterClassId === 'بدون_فصل' ? 'بدون فصل' : 
                 filterClassId === 'بدون_ولي_امر' ? 'بدون ولي أمر' :
                 availableClasses.find(c => c.id === filterClassId)?.name || 'تصفية'}
              </span>
              {filterClassId !== 'الكل' && (
                <span className={cn("w-2 h-2 rounded-full sm:hidden", filterClassId === 'بدون_فصل' ? "bg-amber-300" : "bg-white")} />
              )}
              <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", filterOpen && "rotate-180")} />
            </button>

            {/* Dropdown Popover */}
            {filterOpen && (
              <div className="absolute top-[calc(100%+8px)] left-0 z-50 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="p-2">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest px-3 py-2">اختر الفصل</p>
                  
                  <FilterOption
                    label="📚 جميع الفصول"
                    active={filterClassId === 'الكل'}
                    onClick={() => handleFilterChange('الكل')}
                  />
                  <FilterOption
                    label="⚠️ بدون فصل"
                    active={filterClassId === 'بدون_فصل'}
                    activeColor="amber"
                    onClick={() => handleFilterChange('بدون_فصل')}
                  />
                  <FilterOption
                    label="👤 بدون ولي أمر"
                    active={filterClassId === 'بدون_ولي_امر'}
                    activeColor="rose"
                    onClick={() => handleFilterChange('بدون_ولي_امر')}
                  />

                  {availableClasses.length > 0 && (
                    <div className="my-1.5 border-t border-slate-100 mx-2" />
                  )}

                  {availableClasses.map(cls => (
                    <FilterOption
                      key={cls.id}
                      label={cls.name}
                      active={filterClassId === cls.id}
                      onClick={() => handleFilterChange(cls.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Students Grid */}
        <div className="flex-1 min-w-0 w-full">
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
              skeleton={<StudentsGridSkeleton />}
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {totalItems} طالب — الصفحة {page}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {students.map(s => (
                    <StudentCard key={s.id} student={s as any} onClick={() => handleShowDetail(s)} />
                  ))}
                </div>

                <DataPagination
                  currentPage={page}
                  totalItems={totalItems}
                  pageSize={PAGE_SIZE}
                  onPageChange={setPage}
                />
              </div>
            </QueryStateHandler>
          </div>
      </div>

      {selectedStudent && (
        <EditStudentModal
          student={selectedStudent}
          classes={classes}
          user={user}
          onClose={() => { setShowEdit(false); setSelectedStudent(null); }}
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

      {/* Confirm Delete Dialog */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف الطالب</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا الطالب؟ لا يمكن التراجع عن هذا الإجراء وسيتم حذف جميع البيانات المرتبطة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteTargetId && handleDeleteStudent(deleteTargetId)}
            >
              {deleteMutation.isPending ? 'جاري الحذف...' : 'حذف'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

function StudentCard({ student, onClick }: { student: any; onClick: () => void }) {
  return (
    <div 
      className="group bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl overflow-hidden hover:-translate-y-1 transition-all duration-300 text-right cursor-pointer" 
      onClick={onClick}
    >
      <div className="p-6 flex flex-col gap-4">
        {/* Header: avatar + grade badge */}
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 transition-all duration-300 group-hover:bg-indigo-600 group-hover:text-white group-hover:rotate-6 shrink-0">
            <User className="w-6 h-6 stroke-[2.5px]" />
          </div>
          <Badge variant="outline" className="rounded-xl px-3 py-1 bg-slate-50 border-slate-100 text-[10px] font-bold text-slate-400 max-w-[120px] truncate group-hover:border-indigo-100 group-hover:text-indigo-500 transition-colors">
            {student.classes?.grade_level || 'غير محدد'}
          </Badge>
        </div>

        {/* Name + Class */}
        <div>
          <h3 className="text-lg font-black text-slate-900 group-hover:text-indigo-700 transition-colors leading-tight truncate mb-1">
            {student.name}
          </h3>
          <div className="flex items-center gap-2 text-slate-400">
            <School className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs font-semibold truncate">{student.classes?.name || 'بدون فصل'}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ring-4 ring-emerald-500/20" />
            <span className="text-[11px] font-black text-emerald-600 uppercase tracking-widest">مُنتظم</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all duration-300">
            <ArrowRight className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
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

  // Normalize classes to always be an array
  const normalizedClasses = Array.isArray(classes) ? classes : [];

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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-3 sm:p-4 text-right animate-in fade-in" onClick={onClose}>
      <div className="bg-white border border-slate-100 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 sm:p-8 rounded-2xl sm:rounded-[40px] animate-in zoom-in-95 relative overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-indigo-50/50 rounded-bl-[80px] sm:rounded-bl-[100px]" />
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-6 sm:mb-8 tracking-tight relative z-10">إضافة طالب جديد</h2>
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 relative z-10">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">اسم الطالب بالكامل *</label>
            <Input value={name} onChange={e => setName(e.target.value)} required
              className="h-12 sm:h-14 px-4 sm:px-6 rounded-xl sm:rounded-2xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-primary/10 font-bold text-sm shadow-inner transition-all" placeholder="مثال: أحمد محمد علي" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">الفصل الدراسي</label>
              <select value={classId} onChange={e => setClassId(e.target.value)}
                className="w-full h-12 sm:h-14 px-4 sm:px-6 rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all font-bold text-sm appearance-none shadow-inner">
                <option value="">بدون فصل</option>
                {normalizedClasses.map((cls: any) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">رقم هاتف ولي الأمر</label>
              <Input value={parentPhone} onChange={e => setParentPhone(e.target.value)}
                className="h-12 sm:h-14 px-4 sm:px-6 rounded-xl sm:rounded-2xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all font-bold text-sm shadow-inner"
                placeholder="05xxxxxxxx" dir="ltr" />
            </div>
          </div>
          <div className="flex gap-3 sm:gap-4 pt-4 sm:pt-6">
            <Button type="submit" disabled={addMutation.isPending}
              className="flex-[2] h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-slate-900 text-white font-black shadow-xl hover:bg-primary transition-all text-sm">
              {addMutation.isPending ? 'جاري الحفظ...' : 'تأكيد الحفظ'}
            </Button>
            <Button type="button" onClick={onClose} variant="ghost"
              className="flex-1 h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-slate-50 text-slate-500 font-black text-sm">إلغاء</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EditStudentModal({ student, classes, user, onClose, onSuccess }: any) {
    const [name, setName] = useState(student?.name || '');
    const [classId, setClassId] = useState(student?.class_id || '');
    const [parentPhone, setParentPhone] = useState(student?.parent_phone || '');
    const updateMutation = useUpdateStudent();
  
    // Normalize classes to always be an array
    const normalizedClasses = Array.isArray(classes) ? classes : [];

    useEffect(() => {
      if (student) {
        setName(student.name || '');
        setClassId(student.class_id || '');
        setParentPhone(student.parent_phone || '');
      }
    }, [student]);
  
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

        if (onSuccess) onSuccess();
      } catch (err: unknown) {
        void err; // toast shown by mutation onError
      }
    };
  
    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-3 sm:p-4 text-right animate-in fade-in" onClick={onClose}>
        <div className="bg-white border border-slate-100 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 sm:p-8 rounded-2xl sm:rounded-[40px] animate-in zoom-in-95 relative overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-indigo-50/50 rounded-bl-[80px] sm:rounded-bl-[100px]" />
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-6 sm:mb-8 tracking-tight relative z-10">تعديل بيانات الطالب</h2>
          <form onSubmit={handleSave} className="space-y-4 sm:space-y-6 relative z-10">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">اسم الطالب بالكامل *</label>
              <Input value={name} onChange={e => setName(e.target.value)} required
                className="h-12 sm:h-14 px-4 sm:px-6 rounded-xl sm:rounded-2xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-primary/10 font-bold text-sm shadow-inner" />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">الفصل</label>
                <select value={classId} onChange={e => setClassId(e.target.value)}
                  className="w-full h-12 sm:h-14 px-4 sm:px-6 rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all font-bold text-sm appearance-none shadow-inner">
                  <option value="">بدون فصل</option>
                  {normalizedClasses.map((cls: any) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">رقم هاتف ولي الأمر</label>
                <Input value={parentPhone} onChange={e => setParentPhone(e.target.value)}
                  className="h-12 sm:h-14 px-4 sm:px-6 rounded-xl sm:rounded-2xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all font-bold text-sm shadow-inner"
                  placeholder="05xxxxxxxx" dir="ltr" />
              </div>
            </div>

            <div className="flex gap-3 sm:gap-4 pt-4 sm:pt-6">
              <Button type="submit" disabled={updateMutation.isPending}
                className="flex-[2] h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-slate-900 text-white font-black shadow-xl hover:bg-primary transition-all text-sm">
                {updateMutation.isPending ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </Button>
              <Button type="button" onClick={onClose} variant="ghost"
                className="flex-1 h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-slate-50 text-slate-500 font-black text-sm">إلغاء</Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

// ─── Filter Option Component ──────────────────────────────────────────────────
function FilterOption({ 
  label, 
  active, 
  activeColor = 'indigo',
  onClick 
}: { 
  label: string; 
  active: boolean; 
  activeColor?: 'indigo' | 'amber' | 'rose';
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-right transition-all",
        active
          ? activeColor === 'amber'
            ? "bg-amber-50 text-amber-700"
            : activeColor === 'rose'
            ? "bg-rose-50 text-rose-700"
            : "bg-indigo-50 text-indigo-700"
          : "text-slate-600 hover:bg-slate-50"
      )}
    >
      <span className="truncate">{label}</span>
      {active && (
        <Check className={cn(
          "w-4 h-4 shrink-0",
          activeColor === 'amber' ? "text-amber-500" :
          activeColor === 'rose' ? "text-rose-500" :
          "text-indigo-500"
        )} />
      )}
    </button>
  );
}
