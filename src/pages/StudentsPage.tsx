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
import { sendPushToUser } from '@/utils/pushNotifications';
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
  const [schoolBranding, setSchoolBranding] = useState({ name: 'إدارة عربية', logo: '' });

  useEffect(() => {
    const fetchBranding = async () => {
      if (user?.schoolId) {
        const { data } = await supabase.from('schools').select('name, logo_url, icon_url').eq('id', user.schoolId).single();
        if (data) {
          setSchoolBranding({
            name: data.name,
            logo: data.icon_url || data.logo_url || ''
          });
        }
      }
    };
    fetchBranding();
  }, [user?.schoolId]);

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

  // For the Add modal we still need classes
  const [classes, setClasses] = useState<{id: string, name: string}[]>([]);

  // Load classes for the Add modal
  const loadModalData = async () => {
    if (!user?.schoolId) return;
    const { data: classesData } = await supabase.from('classes').select('id, name').eq('school_id', user.schoolId);
    setClasses(classesData || []);
  };

  useEffect(() => {
    if (showAdd) loadModalData();
  }, [showAdd]);

  return (
    <AppLayout>
      <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-4 duration-1000 max-w-[1500px] mx-auto text-right pb-14">
        {/* Premium Header - Dynamic & Modern */}
        <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 bg-white/40 backdrop-blur-md p-10 sm:p-14 rounded-[56px] border border-white/50 shadow-xl shadow-slate-200/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          <div className="space-y-4 relative z-10">
            <div className="flex items-center gap-4">
               <div className="w-14 h-14 rounded-[22px] bg-slate-900 flex items-center justify-center text-white shadow-2xl rotate-3 group-hover:rotate-0 transition-all duration-500">
                  <GraduationCap className="w-7 h-7" />
               </div>
               <h1 className="text-4xl font-black text-slate-900 tracking-tight">إدارة شؤون الطلاب</h1>
            </div>
            <p className="text-slate-500 font-medium text-lg pr-1">قاعدة البيانات المركزية، السجلات الأكاديمية، ونتائج المتابعة الشاملة.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 relative z-10">
             {user?.role === 'admin' && (
               <Button 
                 onClick={() => setShowAdd(true)} 
                 className="h-16 px-10 rounded-[24px] bg-indigo-600 text-white font-black hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-indigo-200 gap-3 text-lg"
               >
                 <Plus className="w-6 h-6" /> إضافة طالب جديد
               </Button>
             )}
          </div>
        </header>

        {/* Filters and Search - Premium Scaling */}
        <div className="flex flex-col lg:flex-row gap-6 items-center">
          <div className="relative group flex-1 w-full">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-violet-500/20 rounded-[28px] blur opacity-0 group-focus-within:opacity-100 transition duration-1000" />
            <div className="relative">
              <Search className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
              <Input 
                placeholder="ابحث عن اسم الطالب..." 
                value={search}
                onChange={e => handleSearch(e.target.value)}
                className="h-16 pr-14 pl-8 rounded-[24px] border-none bg-white text-lg font-bold shadow-xl shadow-slate-200/50 transition-all focus:ring-0 placeholder:text-slate-300" 
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3 overflow-x-auto pb-4 no-scrollbar lg:w-auto w-full px-2">
            {availableClasses.map(cls => (
              <button 
                key={cls} 
                onClick={() => handleFilterChange(cls)}
                className={cn(
                  "px-8 py-4 rounded-[20px] text-xs font-black whitespace-nowrap transition-all border-2 shadow-sm shrink-0",
                  filterClass === cls
                    ? "bg-slate-900 border-slate-900 text-white shadow-2xl scale-105"
                    : "bg-white border-transparent text-slate-400 hover:border-slate-100 hover:text-indigo-600"
                )}>
                {cls === 'الكل' ? 'جميع الفصول' : `فصل ${cls}`}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-6">
            <div className="w-14 h-14 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-slate-400 font-black tracking-[0.2em] text-xs uppercase">جاري مزامنة بيانات الطلاب</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 p-32 text-center rounded-[56px] shadow-inner relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-24 h-24 rounded-[40px] bg-slate-50 flex items-center justify-center mx-auto mb-8 text-slate-200 relative z-10 group-hover:scale-110 transition-transform duration-500">
              <GraduationCap className="w-12 h-12" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2 relative z-10">لم يتم العثور على نتائج</h2>
            <p className="text-slate-400 font-medium text-lg max-w-sm mx-auto relative z-10">تأكد من كتابة الاسم بشكل صحيح أو تغيير معايير التصفية.</p>
          </div>
        ) : (
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
              {paginated.map(s => (
                <StudentCard key={s.id} student={s as any} onClick={() => navigate(`/students/${s.id}`)} />
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
        )}
      </div>

      {showAdd && (
        <AddStudentModal 
          classes={classes} 
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
function AddStudentModal({ classes, user, onClose, onSuccess }: any) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [classId, setClassId] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const normalizedPhone = parentPhone.replace(/\D/g, '');
    const { data: student, error } = await supabase.from('students').insert({ 
      name: name.trim(), 
      class_id: classId || null,
      parent_phone: normalizedPhone || null,
      school_id: user?.schoolId
    }).select().single();
    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }
    toast({ title: 'تمت الإضافة بنجاح' });
    onSuccess();
    setLoading(false);
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
            <Button type="submit" disabled={loading}
              className="flex-[2] h-14 rounded-2xl bg-slate-900 text-white font-black shadow-xl hover:bg-primary transition-all text-sm">
              {loading ? 'جاري الحفظ...' : 'تأكيد الحفظ'}
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
    const [loading, setLoading] = useState(false);
  
    const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) return;
      setLoading(true);

      try {
        // 1. Update student
        const normalizedPhone = parentPhone.replace(/\D/g, '');
        const { error } = await supabase.from('students').update({ 
          name: name.trim(), 
          class_id: classId || null,
          parent_phone: normalizedPhone || null
        }).eq('id', student.id);
        
        if (error) throw error;

        // 2. Notify Parent if linked
        const { data: parentLink } = await supabase
          .from('student_parents')
          .select('parent_id')
          .eq('student_id', student.id)
          .maybeSingle();
        
        if (parentLink) {
          await sendPushToUser({
            userId: parentLink.parent_id,
            title: schoolBranding.name,
            body: `تحديث بيانات الطالب: تم تحديث بيانات الطالب ${name.trim()} من قبل الإدارة.`,
            url: `/parent/children/${student.id}`
          });
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
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">رقم هاتف ولي الأمر</label>
                <Input value={parentPhone} onChange={e => setParentPhone(e.target.value)}
                  className="h-14 px-6 rounded-2xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all font-bold text-sm shadow-inner"
                  placeholder="05xxxxxxxx" dir="ltr" />
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
