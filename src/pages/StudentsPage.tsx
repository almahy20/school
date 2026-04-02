import { useState, useMemo, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useStudents } from '@/hooks/queries';
import DataPagination from '@/components/ui/DataPagination';
import { 
  Plus, Search, GraduationCap, School, User, 
  Eye, Edit2, Trash2, Filter, MoreHorizontal,
  ChevronLeft, ArrowRight, BookOpen, Clock, Activity,
  Calendar, CheckCircle, Shield, AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const PAGE_SIZE = 15;

export default function StudentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── React Query (cached, no re-fetch on navigation) ──
  const { data: students = [], isLoading: loading } = useStudents();

  // ── Local UI state ──
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('الكل');
  const [showAdd, setShowAdd] = useState(false);
  const [page, setPage] = useState(1);

  // Derive classes list for filter dropdown
  const availableClasses = useMemo(() => [
    'الكل',
    ...new Set(students.map(s => (s as any).classes?.name).filter(Boolean) as string[])
  ], [students]);

  // Filter
  const filtered = useMemo(() => students.filter(s => {
    const matchSearch = !search || (s.name || '').includes(search);
    const matchClass = filterClass === 'الكل' || (s as any).classes?.name === filterClass;
    return matchSearch && matchClass;
  }), [students, search, filterClass]);

  // Paginate (reset to page 1 when filters change)
  const totalItems = filtered.length;
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const handleFilterChange = (val: string) => { setFilterClass(val); setPage(1); };
  const handleSearch = (val: string) => { setSearch(val); setPage(1); };

  // For the Add modal we still need classes & parents lists
  const [classes, setClasses] = useState<{id: string, name: string}[]>([]);
  const [parents, setParents] = useState<{id: string, full_name: string}[]>([]);

  // Load classes + parents for the Add modal (lightweight, only when modal opens)
  const loadModalData = async () => {
    if (!user?.schoolId) return;
    const [{ data: classesData }, { data: rolesData }] = await Promise.all([
      supabase.from('classes').select('id, name').eq('school_id', user.schoolId),
      supabase.from('user_roles').select('user_id').eq('role', 'parent').eq('school_id', user.schoolId),
    ]);
    setClasses(classesData || []);
    const parentIds = (rolesData || []).map(r => r.user_id);
    if (parentIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles').select('id, full_name').in('id', parentIds).order('full_name');
      setParents(profilesData || []);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1400px] mx-auto text-right pb-10">
        {/* Premium Header - Scaled Down */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/40 backdrop-blur-md p-8 rounded-[40px] border border-white/50 shadow-xl shadow-slate-200/10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="w-1.5 h-7 bg-indigo-600 rounded-full" />
               <h1 className="text-2xl font-black text-slate-900 tracking-tight">إدارة شؤون الطلاب</h1>
            </div>
            <p className="text-slate-500 font-medium text-sm pr-4">قاعدة بيانات الطلاب، السجلات الأكاديمية ونتائج المتابعة</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
             {user?.role === 'admin' && (
               <Button onClick={() => setShowAdd(true)} className="h-12 px-6 rounded-2xl bg-slate-900 text-white font-black text-sm shadow-xl shadow-slate-900/10 hover:scale-[1.02] active:scale-95 transition-all gap-3">
                 <Plus className="w-4.5 h-4.5" /> إضافة طالب جديد
               </Button>
             )}
          </div>
        </header>

        {/* Filters and Search - Scaled Down */}
        <div className="flex flex-col lg:flex-row gap-4 items-center">
          <div className="relative group flex-1 w-full">
            <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
            <Input 
              placeholder="ابحث عن اسم الطالب..." 
              value={search}
              onChange={e => handleSearch(e.target.value)}
              className="h-12 pr-12 pl-6 rounded-[20px] border-none bg-white text-sm font-bold shadow-sm transition-all focus:ring-4 focus:ring-indigo-600/5" 
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide lg:w-auto w-full">
            {availableClasses.map(cls => (
              <button 
                key={cls} 
                onClick={() => handleFilterChange(cls)}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-xs font-black whitespace-nowrap transition-all border shadow-sm shrink-0",
                  filterClass === cls
                    ? "bg-slate-900 border-slate-900 text-white shadow-lg"
                    : "bg-white border-white text-slate-400 hover:text-indigo-600"
                )}>
                {cls === 'الكل' ? 'جميع الفصول' : cls}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-slate-300 font-black tracking-widest text-[10px] uppercase">جاري مزامنة قواعد البيانات</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 p-24 text-center rounded-[48px] shadow-sm">
            <div className="w-20 h-20 rounded-[32px] bg-slate-50 flex items-center justify-center mx-auto mb-6 text-slate-200">
              <GraduationCap className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2">لا يوجد طلاب</h2>
            <p className="text-slate-400 font-medium text-sm max-w-xs mx-auto">لم نعثر على أي طلاب يطابقون معايير البحث الحالية.</p>
          </div>
        ) : (
          <>
            {/* Results summary */}
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                {totalItems} طالب — الصفحة {page}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {paginated.map(s => (
                <StudentCard key={s.id} student={s as any} onClick={() => navigate(`/students/${s.id}`)} />
              ))}
            </div>
            <DataPagination
              currentPage={page}
              totalItems={totalItems}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      {showAdd && (
        <AddStudentModal 
          classes={classes} 
          parents={parents} 
          user={user} 
          onClose={() => setShowAdd(false)} 
          onSuccess={() => { 
            setShowAdd(false);
            queryClient.invalidateQueries({ queryKey: ['students', user?.schoolId] }); 
          }} 
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
function AddStudentModal({ classes, parents, user, onClose, onSuccess }: any) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [classId, setClassId] = useState('');
  const [parentId, setParentId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const { data: student, error } = await supabase.from('students').insert({ 
      name: name.trim(), 
      class_id: classId || null,
      school_id: user?.schoolId
    }).select().single();
    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }
    // Link to parent if selected
    if (student && parentId) {
      await supabase.from('student_parents').insert({
        student_id: student.id,
        parent_id: parentId,
        school_id: user?.schoolId,
      });
    }
    toast({ title: 'تمت الإضافة بنجاح' });
    onSuccess();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-right animate-in fade-in" onClick={onClose}>
      <div className="bg-white border border-slate-100 shadow-2xl w-full max-w-lg p-8 rounded-[40px] animate-in zoom-in-95 relative overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-bl-[80px]" />
        <h2 className="text-2xl font-black text-slate-900 mb-8 tracking-tight relative z-10">إضافة طالب جديد</h2>
        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">اسم الطالب بالكامل *</label>
            <Input value={name} onChange={e => setName(e.target.value)} required
              className="h-14 px-5 rounded-xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-primary/10 font-bold text-sm" placeholder="مثال: أحمد محمد علي" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">الفصل الدراسي</label>
              <select value={classId} onChange={e => setClassId(e.target.value)}
                className="w-full h-14 px-5 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all font-bold text-sm appearance-none">
                <option value="">بدون فصل</option>
                {classes.map((cls: any) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">ولي الأمر</label>
              <select value={parentId} onChange={e => setParentId(e.target.value)}
                className="w-full h-14 px-5 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all font-bold text-sm appearance-none">
                <option value="">لا يوجد / غير محدد</option>
                {parents.map((p: any) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading}
              className="flex-1 h-14 rounded-xl bg-slate-900 text-white font-black shadow-lg hover:bg-primary transition-all text-sm">
              {loading ? 'جاري الحفظ...' : 'تأكيد الحفظ'}
            </Button>
            <Button type="button" onClick={onClose} variant="ghost"
              className="flex-1 h-14 rounded-xl bg-slate-50 text-slate-500 font-black text-sm">إلغاء</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EditStudentModal({ student, classes, parents, user, onClose, onSuccess }: any) {
    const { toast } = useToast();
    const [name, setName] = useState(student.name);
    const [classId, setClassId] = useState(student.class_id || '');
    const [parentId, setParentId] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      // Fetch current parent
      supabase.from('student_parents')
        .select('parent_id')
        .eq('student_id', student.id)
        .single()
        .then(({ data }) => {
          if (data) setParentId(data.parent_id);
        });
    }, [student.id]);
  
    const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) return;
      setLoading(true);

      try {
        // 1. Update student
        const { error } = await supabase.from('students').update({ 
          name: name.trim(), 
          class_id: classId || null 
        }).eq('id', student.id);
        
        if (error) throw error;

        // 2. Update parent link
        if (parentId) {
          await supabase.from('student_parents').upsert({
            student_id: student.id,
            parent_id: parentId,
            school_id: user?.schoolId,
          }, { onConflict: 'student_id,parent_id' });
        } else {
          // Remove link if set to empty
          await supabase.from('student_parents').delete().eq('student_id', student.id);
        }

        toast({ title: 'تم التحديث بنجاح' });
        onSuccess();
      } catch (err: any) {
        toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
      } finally {
        setLoading(false);
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
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">ولي الأمر</label>
                <select value={parentId} onChange={e => setParentId(e.target.value)}
                  className="w-full h-14 px-6 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all font-bold text-sm appearance-none shadow-inner">
                  <option value="">لا يوجد / غير محدد</option>
                  {parents.map((p: any) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-4 pt-6">
              <Button type="submit" disabled={loading}
                className="flex-[2] h-14 rounded-2xl bg-slate-900 text-white font-black shadow-xl hover:bg-primary transition-all text-sm">
                {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </Button>
              <Button type="button" onClick={onClose} variant="ghost"
                className="flex-1 h-14 rounded-2xl bg-slate-50 text-slate-500 font-black text-sm">إلغاء</Button>
            </div>
          </form>
        </div>
      </div>
    );
  }
