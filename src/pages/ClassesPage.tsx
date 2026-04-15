import { useState, useMemo, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useClasses, useTeachers, useAddClass, useUpdateClass, useDeleteClass } from '@/hooks/queries';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import DataPagination from '@/components/ui/DataPagination';
import { 
  Plus, Users, School, User, Search, Filter, 
  MoreHorizontal, ChevronLeft, ArrowRight, Trash2, Edit3
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import DataDetailModal from '@/components/DataDetailModal';
import PageHeader from '@/components/layout/PageHeader';

interface ClassItem {
  id: string;
  name: string;
  grade_level: string | null;
  teacher_id: string | null;
  teacher_name?: string;
  student_count?: number;
}

export default function ClassesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState('الكل');
  const [showAdd, setShowAdd] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  // ── Debounce Search ──
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  // ── React Query Hooks ──
  const { 
    data: classesData, 
    isLoading: classesLoading, 
    error, 
    refetch, 
    isRefetching 
  } = useClasses(page, PAGE_SIZE, debouncedSearch, filterLevel);

  // جلب كافة المعلمين والطلاب (لأغراض العرض التكميلي فقط)
  // يفضل مستقبلاً استخدام joins من الخادم مباشرة لكل ما هو ممكن
  const { data: teachersData, isLoading: teachersLoading } = useTeachers(1, 1000, '', 'الكل');
  const teachers = useMemo(() => teachersData?.data || [], [teachersData]);
  
  // For student count, we need ALL students in the school (not just teacher's classes)
  // So we fetch directly from Supabase instead of using useStudents hook
  const [students, setStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  
  useEffect(() => {
    const fetchAllStudents = async () => {
      if (!user?.schoolId) {
        setStudents([]);
        setStudentsLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('students')
        .select('id, name, class_id')
        .eq('school_id', user.schoolId);
      
      if (data) {
        setStudents(data);
      }
      setStudentsLoading(false);
    };
    
    fetchAllStudents();
  }, [user?.schoolId]);

  const addMutation = useAddClass();
  const deleteMutation = useDeleteClass();

  // Enrich classes with teacher name and student count
  const classes = useMemo(() => {
    return (classesData?.data || []).map(c => ({
      ...c,
      teacher_name: (c as any).profiles?.full_name || teachers.find(t => t.id === c.teacher_id)?.full_name || 'غير محدد',
      student_count: students.filter(s => s.class_id === c.id).length
    }));
  }, [classesData, teachers, students]);

  const totalItems = classesData?.count || 0;
  const loading = classesLoading || (teachersLoading && !classesData) || (studentsLoading && !classesData);

  // نستخدم قائمة المراحل من الخادم أو ثابتة بدلاً من استنتاجها من البيانات المجزأة
  const gradeLevels = useMemo(() => ['الكل', 'الصف الأول', 'الصف الثاني', 'الصف الثالث', 'الصف الرابع', 'الصف الخامس', 'الصف السادس'], []);

  const handleSearch = (val: string) => { setSearch(val); setPage(1); };
  const handleFilterChange = (val: string) => { setFilterLevel(val); setPage(1); };  return (
    <AppLayout>
      <div className="flex flex-col gap-6 md:gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-6xl mx-auto text-right pt-2 pb-20 px-4 md:px-6">
        <PageHeader
          icon={School}
          title="إدارة الفصول الدراسية"
          subtitle="تنظيم الكثافة الطلابية وتوزيع الهيئة التدريسية"
          action={
            user?.role === 'admin' && (
              <Button onClick={() => setShowAdd(true)} className="h-12 px-8 rounded-2xl bg-slate-900 text-white font-black text-sm shadow-xl shadow-slate-900/10 hover:scale-[1.02] active:scale-95 transition-all gap-3">
                <Plus className="w-5 h-5" /> إنشاء فصل جديد
              </Button>
            )
          }
        />

        {/* Filters and Search - Scaled Down */}
        <div className="flex flex-col lg:flex-row gap-4 items-center">
          <div className="relative group flex-1 w-full">
            <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
            <Input 
              placeholder="ابحث عن فصل أو معلم مسؤول..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-12 pr-12 pl-6 rounded-[20px] border-none bg-white text-sm font-bold shadow-sm transition-all focus:ring-4 focus:ring-indigo-600/5" 
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide lg:w-auto w-full">
            {gradeLevels.map(level => (
              <button 
                key={level} 
                onClick={() => handleFilterChange(level)}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-xs font-black whitespace-nowrap transition-all border shadow-sm shrink-0",
                  filterLevel === level
                    ? "bg-slate-900 border-slate-900 text-white shadow-lg"
                    : "bg-white border-white text-slate-400 hover:text-indigo-600"
                )}>
                {level === 'الكل' ? 'جميع المراحل' : level}
              </button>
            ))}
          </div>
        </div>

        <QueryStateHandler
          loading={loading}
          error={error}
          data={classesData?.data || []}
          onRetry={refetch}
          isRefetching={isRefetching}
          loadingMessage="جاري مزامنة بيانات الفصول..."
          errorMessage="فشل تحميل قائمة الفصول."
          isEmpty={classes.length === 0}
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                {totalItems} فصل — الصفحة {page}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {classes.map(c => (
                <ClassCard key={c.id} classItem={c as any} onClick={() => navigate(`/classes/${c.id}`)} />
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

      {showAdd && (
        <AddClassModal 
          teachers={teachers} 
          user={user}
          onClose={() => { setShowAdd(false); }}
          onSuccess={() => { setShowAdd(false); queryClient.invalidateQueries({ queryKey: ['classes', user?.schoolId] }); }} 
        />
      )}
    </AppLayout>
  );
}

function ClassCard({ classItem, onClick }: { classItem: ClassItem; onClick: () => void }) {
  const capacity = 30;
  const percentage = Math.min((classItem.student_count || 0) / capacity * 100, 100);

  return (
    <div 
      className="group premium-card p-0 overflow-hidden hover:translate-y-[-4px] transition-all duration-500 text-right cursor-pointer" 
      onClick={onClick}
    >
      <div className="p-5 md:p-6 space-y-5 md:space-y-6">
         <div className="flex items-start justify-between">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-[16px] md:rounded-[18px] bg-indigo-50 flex items-center justify-center text-indigo-600 transition-all group-hover:bg-slate-900 group-hover:text-white group-hover:rotate-6 shadow-inner shrink-0">
               <School className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <Badge variant="outline" className="rounded-lg px-2.5 py-0.5 md:px-3 md:py-1 bg-slate-50 border-slate-100 text-[8px] md:text-[9px] font-black uppercase tracking-widest text-slate-400">
               {classItem.grade_level || 'مرحلة عامة'}
            </Badge>
         </div>

         <div>
            <h3 className="text-base md:text-lg font-black text-slate-900 mb-1.5 group-hover:text-indigo-600 transition-colors leading-tight">{classItem.name}</h3>
            <div className="flex items-center gap-2 text-slate-400">
               <User className="w-3 h-3 md:w-3.5 md:h-3.5" />
               <span className="text-[9px] md:text-[10px] font-black tracking-tight">{classItem.teacher_name}</span>
            </div>
         </div>

         <div className="space-y-2">
            <div className="flex justify-between items-end text-[7px] md:text-[8px] font-black uppercase tracking-widest">
               <span className="text-slate-300">سعة الطلاب</span>
               <span className={cn("font-black", percentage > 90 ? "text-rose-500" : "text-indigo-600")}>{classItem.student_count} / {capacity}</span>
            </div>
            <Progress value={percentage} className="h-1 md:h-1.5 bg-slate-100" />
         </div>

         <div className="flex gap-3 md:gap-4 pt-2 border-t border-slate-50">
            <div className="flex-1 h-10 md:h-11 rounded-xl bg-slate-900 text-white font-black group-hover:bg-indigo-600 transition-all flex items-center justify-center text-[10px] md:text-xs">
               استعراض الفصل
            </div>
         </div>
      </div>
    </div>
  );
}

// ─── Modals ────────────────────────────────────────────────────────────────────
function ModalShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100001] p-4 text-right animate-in fade-in" 
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-lg rounded-[48px] shadow-2xl shadow-slate-900/20 animate-in zoom-in-95 duration-300 relative overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        {/* Decorative accent */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50/60 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        {children}
      </div>
    </div>
  );
}

function AddClassModal({ teachers, user, onClose, onSuccess }: { teachers: any; user: any; onClose: () => void; onSuccess?: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const addMutation = useAddClass();
  const teachersArray = Array.isArray(teachers) ? teachers : (teachers?.data || []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await addMutation.mutateAsync({ name: name.trim(), grade_level: gradeLevel.trim() || null, teacher_id: teacherId || null, school_id: user?.schoolId });
      toast({ title: 'تمت الإضافة بنجاح' });
      if (onSuccess) onSuccess(); else onClose();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message || 'فشل في إضافة الفصل', variant: 'destructive' });
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="p-10 relative z-10">
        <div className="mb-10">
          <div className="w-16 h-16 rounded-[24px] bg-indigo-600 flex items-center justify-center mb-6 shadow-xl shadow-indigo-200">
            <School className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">إنشاء فصل جديد</h2>
          <p className="text-sm text-slate-400 font-medium mt-1">أدخل بيانات الفصل الدراسي الجديد</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 pr-1 uppercase tracking-widest block">اسم الفصل *</label>
            <Input value={name} onChange={e => setName(e.target.value)}
              className="h-14 px-6 rounded-2xl border-slate-100 bg-slate-50 focus:bg-white font-bold text-sm" placeholder="مثال: 1أ" required />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 pr-1 uppercase tracking-widest block">المرحلة الدراسية</label>
            <Input value={gradeLevel} onChange={e => setGradeLevel(e.target.value)}
              className="h-14 px-6 rounded-2xl border-slate-100 bg-slate-50 focus:bg-white font-bold text-sm" placeholder="مثال: الصف الأول الابتدائي" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 pr-1 uppercase tracking-widest block">المعلم الرئيسي</label>
            <select value={teacherId} onChange={e => setTeacherId(e.target.value)}
              className="w-full h-14 px-6 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all font-bold text-sm appearance-none">
              <option value="">بدون معلم رئيسي</option>
              {teachersArray.map((t: any) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
          </div>
          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={addMutation.isPending}
              className="flex-[2] h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-xl shadow-indigo-100 text-sm">
              {addMutation.isPending ? 'جاري الإضافة...' : 'إنشاء الفصل'}
            </Button>
            <Button type="button" onClick={onClose} variant="ghost"
              className="flex-1 h-14 rounded-2xl bg-slate-50 text-slate-500 font-black text-sm hover:bg-slate-100">إلغاء</Button>
          </div>
        </form>
      </div>
    </ModalShell>
  );
}

export function EditClassModal({ classItem, teachers, onClose, onSuccess }: any) {
  const { toast } = useToast();
  const [name, setName] = useState(classItem.name);
  const [gradeLevel, setGradeLevel] = useState(classItem.grade_level || '');
  const [teacherId, setTeacherId] = useState(classItem.teacher_id || '');
  const updateMutation = useUpdateClass();
  const teachersArray = Array.isArray(teachers) ? teachers : (teachers?.data || []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await updateMutation.mutateAsync({ id: classItem.id, name: name.trim(), grade_level: gradeLevel.trim() || null, teacher_id: teacherId || null });
      toast({ title: 'تم الحفظ بنجاح' });
      onSuccess();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message || 'فشل في تحديث الفصل', variant: 'destructive' });
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="p-10 relative z-10">
        <div className="mb-10">
          <div className="w-16 h-16 rounded-[24px] bg-slate-900 flex items-center justify-center mb-6 shadow-xl shadow-slate-200">
            <Edit3 className="w-8 h-8 text-indigo-400" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">تعديل إعدادات الفصل</h2>
          <p className="text-sm text-slate-400 font-medium mt-1">قم بتحديث بيانات الفصل الدراسي</p>
        </div>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 pr-1 uppercase tracking-widest block">اسم الفصل *</label>
            <Input value={name} onChange={e => setName(e.target.value)}
              className="h-14 px-6 rounded-2xl border-slate-100 bg-slate-50 focus:bg-white font-bold text-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 pr-1 uppercase tracking-widest block">المرحلة الدراسية</label>
            <Input value={gradeLevel} onChange={e => setGradeLevel(e.target.value)}
              className="h-14 px-6 rounded-2xl border-slate-100 bg-slate-50 focus:bg-white font-bold text-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 pr-1 uppercase tracking-widest block">المعلم الرئيسي</label>
            <select value={teacherId} onChange={e => setTeacherId(e.target.value)}
              className="w-full h-14 px-6 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all font-bold text-sm appearance-none">
              <option value="">بدون معلم رئيسي</option>
              {teachersArray.map((t: any) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
          </div>
          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={updateMutation.isPending}
              className="flex-[2] h-14 rounded-2xl bg-slate-900 text-white font-black shadow-xl text-sm hover:bg-slate-800">
              {updateMutation.isPending ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </Button>
            <Button type="button" onClick={onClose} variant="ghost"
              className="flex-1 h-14 rounded-2xl bg-slate-50 text-slate-500 font-black text-sm hover:bg-slate-100">إلغاء</Button>
          </div>
        </form>
      </div>
    </ModalShell>
  );
}
