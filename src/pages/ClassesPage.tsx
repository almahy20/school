import { useState, useMemo, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
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
  } = useClasses(page, PAGE_SIZE, debouncedSearch, 'الكل');

  // جلب كافة المعلمين — فقط لما تُفتح نافذة الإضافة
  const [showAdd, setShowAdd] = useState(false);
  const { data: teachersData } = useTeachers(1, 1000, '', 'الكل', { enabled: showAdd });
  const teachers = useMemo(() => teachersData?.data || [], [teachersData]);
  
  // For student count, we fetch only the necessary columns to be fast
  const [students, setStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  
  useEffect(() => {
    const fetchStudentCounts = async () => {
      if (!user?.schoolId) {
        setStudents([]);
        setStudentsLoading(false);
        return;
      }
      
      const { data } = await supabase
        .from('students')
        .select('id, class_id')
        .eq('school_id', user.schoolId);
      
      if (data) setStudents(data);
      setStudentsLoading(false);
    };
    
    fetchStudentCounts();
  }, [user?.schoolId]);

  const addMutation = useAddClass();
  const deleteMutation = useDeleteClass();

  // Enrich classes manually (since join failed due to missing DB foreign keys)
  const classes = useMemo(() => {
    return (classesData?.data || []).map(c => ({
      ...c,
      teacher_name: teachers.find(t => t.id === c.teacher_id)?.full_name || 'غير محدد',
      student_count: students.filter(s => s.class_id === c.id).length
    }));
  }, [classesData, teachers, students]);

  const totalItems = classesData?.count || 0;
  const loading = classesLoading || (studentsLoading && !classesData);

  // نستخدم قائمة المراحل من الخادم أو ثابتة بدلاً من استنتاجها من البيانات المجزأة

  const handleSearch = (val: string) => { setSearch(val); setPage(1); };

  return (
    <AppLayout>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1400px] mx-auto text-right pb-10 px-2 md:px-0">
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

        {/* Search Bar - Full Width */}
        <div className="relative group mt-6 mb-6">
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
          <Input 
            placeholder="ابحث عن فصل أو معلم مسؤول..." 
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="h-14 pr-14 pl-6 rounded-2xl border-none bg-white text-base font-bold shadow-sm transition-all focus:ring-4 focus:ring-indigo-600/5 w-full" 
          />
          {search && (
            <button
              onClick={() => handleSearch('')}
              className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 transition-colors text-lg font-bold"
            >
              ×
            </button>
          )}
        </div>

        {/* Classes Grid */}
        <div className="flex-1 min-w-0 w-full">
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
              <div className="space-y-5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                    {totalItems} فصل — الصفحة {page}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
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
      className="group premium-card p-0 overflow-hidden hover:translate-y-[-4px] hover:shadow-xl transition-all duration-300 text-right cursor-pointer" 
      onClick={onClick}
    >
      <div className="p-6 flex flex-col gap-4">
        {/* Header: icon only */}
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 transition-all group-hover:bg-indigo-600 group-hover:text-white group-hover:rotate-6 shadow-inner shrink-0">
            <School className="w-6 h-6" />
          </div>
        </div>

        {/* Name + Teacher */}
        <div>
          <h3 className="text-xl font-black text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors leading-tight">
            {classItem.name}
          </h3>
          <div className="flex items-center gap-2 text-slate-400">
            <User className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs font-semibold truncate">{classItem.teacher_name}</span>
          </div>
        </div>

        {/* Student count + progress */}
        <div className="space-y-2 pt-1">
          <div className="flex justify-between items-center text-[11px] font-bold">
            <span className="text-slate-400">الطلاب</span>
            <span className={cn("font-black text-sm", percentage > 90 ? "text-rose-500" : "text-indigo-600")}>
              {classItem.student_count} / {capacity}
            </span>
          </div>
          <Progress value={percentage} className="h-1.5 bg-slate-100" />
        </div>

        {/* CTA */}
        <div className="pt-2 border-t border-slate-50">
          <div className="h-10 rounded-xl bg-slate-900 text-white font-black group-hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 text-sm">
            استعراض الفصل
            <ArrowRight className="w-4 h-4 opacity-60 group-hover:translate-x-[-3px] transition-transform" />
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
  const [teacherId, setTeacherId] = useState('');
  const addMutation = useAddClass();
  const teachersArray = Array.isArray(teachers) ? teachers : (teachers?.data || []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await addMutation.mutateAsync({ name: name.trim(), grade_level: null, teacher_id: teacherId || null, school_id: user?.schoolId });
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
          <p className="text-sm text-slate-400 font-medium mt-1">أدخل بيانات الفصل الجديد</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 pr-1 uppercase tracking-widest block">اسم الفصل *</label>
            <Input value={name} onChange={e => setName(e.target.value)}
              className="h-14 px-6 rounded-2xl border-slate-100 bg-slate-50 focus:bg-white font-bold text-sm" placeholder="مثال: 1أ" required />
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
  const [teacherId, setTeacherId] = useState(classItem.teacher_id || '');
  const updateMutation = useUpdateClass();
  const teachersArray = Array.isArray(teachers) ? teachers : (teachers?.data || []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await updateMutation.mutateAsync({ id: classItem.id, name: name.trim(), grade_level: null, teacher_id: teacherId || null });
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
          <p className="text-sm text-slate-400 font-medium mt-1">قم بتحديث بيانات الفصل</p>
        </div>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 pr-1 uppercase tracking-widest block">اسم الفصل *</label>
            <Input value={name} onChange={e => setName(e.target.value)}
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
