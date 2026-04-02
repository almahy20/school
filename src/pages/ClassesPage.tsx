import { useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useClasses } from '@/hooks/queries';
import DataPagination from '@/components/ui/DataPagination';
import { 
  Plus, Users, School, User, Search, Filter, 
  MoreHorizontal, ChevronLeft, ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState('الكل');
  const [showAdd, setShowAdd] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  // ── React Query for basic fields ──
  const { data: rawClasses = [], isLoading: classesLoading } = useClasses();

  // We still need to join teachers & students locally if we didn't do it in hook
  const { data: enrichedClasses = [], isLoading: metaLoading } = useQuery({
    queryKey: ['classes-enriched', user?.schoolId, rawClasses],
    queryFn: async () => {
      if (rawClasses.length === 0) return [];
      
      const teacherIds = [...new Set(rawClasses.map(c => c.teacher_id).filter(Boolean))];
      const classIds = rawClasses.map(c => c.id);

      let profilesData: any[] = [];
      if (teacherIds.length > 0) {
        const { data } = await supabase.from('profiles').select('id, full_name').in('id', teacherIds);
        profilesData = data || [];
      }

      let studentsData: any[] = [];
      if (classIds.length > 0) {
        // Just getting count via grouping or simple select
        const { data } = await supabase.from('students').select('class_id').in('class_id', classIds);
        studentsData = data || [];
      }

      return rawClasses.map(c => ({
        ...c,
        teacher_name: profilesData.find(p => p.id === c.teacher_id)?.full_name || 'غير محدد',
        student_count: studentsData.filter(s => s.class_id === c.id).length
      }));
    },
    enabled: rawClasses.length > 0
  });

  const loading = classesLoading || (rawClasses.length > 0 && metaLoading);

  // Also need teachers for the Add/Edit dropdown
  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers-dropdown', user?.schoolId],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'teacher').eq('school_id', user?.schoolId);
      if (!roles?.length) return [];
      const teacherIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', teacherIds);
      return profiles || [];
    },
    enabled: !!user?.schoolId
  });

  const gradeLevels = useMemo(() => ['الكل', ...new Set(enrichedClasses.map(c => c.grade_level).filter(Boolean) as string[])], [enrichedClasses]);
  const filtered = useMemo(() => enrichedClasses.filter(c => {
    const matchSearch = !search || c.name.includes(search) || (c.teacher_name || '').includes(search);
    const matchLevel = filterLevel === 'الكل' || c.grade_level === filterLevel;
    return matchSearch && matchLevel;
  }), [enrichedClasses, search, filterLevel]);

  const totalItems = filtered.length;
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // Reset page when search or filter changes
  useState(() => {
    setPage(1);
  });  return (
    <AppLayout>
      <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1400px] mx-auto text-right pb-10">
        {/* Premium Header - Scaled Down */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/40 backdrop-blur-md p-8 rounded-[40px] border border-white/50 shadow-xl shadow-slate-200/10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="w-1.5 h-7 bg-indigo-600 rounded-full" />
               <h1 className="text-2xl font-black text-slate-900 tracking-tight">إدارة الفصول الدراسية</h1>
            </div>
            <p className="text-slate-500 font-medium text-sm pr-4">تنظيم الكثافة الطلابية وتوزيع الهيئة التدريسية</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
             {user?.role === 'admin' && (
               <Button onClick={() => setShowAdd(true)} className="h-11 px-6 rounded-2xl bg-slate-900 text-white font-black text-sm shadow-xl shadow-slate-900/10 hover:scale-[1.02] active:scale-95 transition-all gap-3">
                 <Plus className="w-4.5 h-4.5" /> إنشاء فصل جديد
               </Button>
             )}
          </div>
        </header>

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
                onClick={() => setFilterLevel(level)}
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

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-slate-300 font-black tracking-widest text-[10px] uppercase">جاري استرجاع السجلات</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 p-24 text-center rounded-[48px] shadow-sm">
            <div className="w-20 h-20 rounded-[32px] bg-slate-50 flex items-center justify-center mx-auto mb-6 text-slate-200">
              <School className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2">لا توجد فصول</h2>
            <p className="text-slate-400 font-medium text-sm">لم يتم العثور على أي نتائج تطابق بحثك.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                {totalItems} فصل — الصفحة {page}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {paginated.map(c => (
                <ClassCard key={c.id} classItem={c} onClick={() => navigate(`/classes/${c.id}`)} />
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
    <div className="group premium-card p-0 overflow-hidden hover:translate-y-[-4px] transition-all duration-500 text-right cursor-pointer" onClick={onClick}>
      <div className="p-6 space-y-6">
         <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-[18px] bg-indigo-50 flex items-center justify-center text-indigo-600 transition-all group-hover:bg-slate-900 group-hover:text-white group-hover:rotate-6 shadow-inner shrink-0">
               <School className="w-6 h-6" />
            </div>
            <Badge variant="outline" className="rounded-lg px-3 py-1 bg-slate-50 border-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-400">
               {classItem.grade_level || 'مرحلة عامة'}
            </Badge>
         </div>

         <div>
            <h3 className="text-lg font-black text-slate-900 mb-1.5 group-hover:text-indigo-600 transition-colors leading-tight">{classItem.name}</h3>
            <div className="flex items-center gap-2 text-slate-400">
               <User className="w-3.5 h-3.5" />
               <span className="text-[10px] font-black tracking-tight">{classItem.teacher_name}</span>
            </div>
         </div>

         <div className="space-y-2">
            <div className="flex justify-between items-end text-[8px] font-black uppercase tracking-widest">
               <span className="text-slate-300">سعة الطلاب</span>
               <span className={cn("font-black", percentage > 90 ? "text-rose-500" : "text-indigo-600")}>{classItem.student_count} / {capacity}</span>
            </div>
            <Progress value={percentage} className="h-1.5 bg-slate-100" />
         </div>

         <div className="flex gap-4 pt-2 border-t border-slate-50">
            <Button onClick={onClick} className="flex-1 h-11 rounded-xl bg-slate-900 text-white font-black group-hover:bg-indigo-600 transition-all flex items-center justify-center text-xs">
               استعراض الفصل
            </Button>
         </div>
      </div>
    </div>
  );
}

// ─── Modals (Scaled Down) ────────────────────────────────────────────────────
function AddClassModal({ teachers, user, onClose, onSuccess }: { teachers: any[]; user: any; onClose: () => void; onSuccess?: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [teacherId, setTeacherId] = useState(teachers[0]?.id || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const { error } = await supabase.from('classes').insert({
      name: name.trim(), 
      grade_level: gradeLevel.trim() || null, 
      teacher_id: teacherId || null,
      school_id: user?.schoolId
    });
    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } else { 
      toast({ title: 'تمت الإضافة بنجاح' });
      if (onSuccess) onSuccess(); 
      else onClose();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-right animate-in fade-in" onClick={onClose}>
      <div className="bg-white border border-slate-100 shadow-2xl w-full max-w-lg p-8 rounded-[40px] animate-in zoom-in-95 relative overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-bl-[80px]" />
        <h2 className="text-2xl font-black text-slate-900 mb-8 tracking-tight relative z-10">إنشاء فصل جديد</h2>
        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">اسم الفصل *</label>
            <Input value={name} onChange={e => setName(e.target.value)}
              className="h-12 px-5 rounded-xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-primary/10 font-bold text-sm" placeholder="مثال: 1أ" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">المرحلة الدراسية</label>
            <Input value={gradeLevel} onChange={e => setGradeLevel(e.target.value)}
              className="h-12 px-5 rounded-xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-primary/10 font-bold text-sm" placeholder="مثال: الصف الأول" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">المعلم المسؤول</label>
            <select value={teacherId} onChange={e => setTeacherId(e.target.value)}
              className="w-full h-12 px-5 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all font-bold text-sm appearance-none">
              <option value="">بدون معلم</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading}
              className="flex-1 h-12 rounded-xl bg-slate-900 text-white font-black shadow-lg hover:bg-primary transition-all text-sm">
              {loading ? 'جاري الإضافة...' : 'تأكيد الإضافة'}
            </Button>
            <Button type="button" onClick={onClose} variant="ghost"
              className="flex-1 h-12 rounded-xl bg-slate-50 text-slate-500 font-black text-sm">إلغاء</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EditClassModal({ classItem, teachers, onClose, onSuccess }: any) {
    const { toast } = useToast();
    const [name, setName] = useState(classItem.name);
    const [gradeLevel, setGradeLevel] = useState(classItem.grade_level || '');
    const [teacherId, setTeacherId] = useState(classItem.teacher_id || '');
    const [loading, setLoading] = useState(false);
  
    const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) return;
      setLoading(true);
      const { error } = await supabase.from('classes').update({
        name: name.trim(), grade_level: gradeLevel.trim() || null, teacher_id: teacherId || null,
      }).eq('id', classItem.id);
      if (error) toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      else { toast({ title: 'تم الحفظ بنجاح' }); onSuccess(); }
      setLoading(false);
    };
  
    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-right animate-in fade-in" onClick={onClose}>
        <div className="bg-white border border-slate-100 shadow-2xl w-full max-w-lg p-8 rounded-[40px] animate-in zoom-in-95 relative overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-bl-[80px]" />
          <h2 className="text-2xl font-black text-slate-900 mb-8 tracking-tight relative z-10">تعديل بيانات الفصل</h2>
          <form onSubmit={handleSave} className="space-y-5 relative z-10">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">اسم الفصل *</label>
              <Input value={name} onChange={e => setName(e.target.value)}
                className="h-12 px-5 rounded-xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-primary/10 font-bold text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">المرحلة الدراسية</label>
              <Input value={gradeLevel} onChange={e => setGradeLevel(e.target.value)}
                className="h-12 px-5 rounded-xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-primary/10 font-bold text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">المعلم المسؤول</label>
              <select value={teacherId} onChange={e => setTeacherId(e.target.value)}
                className="w-full h-12 px-5 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all font-bold text-sm appearance-none">
                <option value="">بدون معلم</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={loading}
                className="flex-1 h-12 rounded-xl bg-slate-900 text-white font-black shadow-lg hover:bg-primary transition-all text-sm">
                {loading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </Button>
              <Button type="button" onClick={onClose} variant="ghost"
                className="flex-1 h-12 rounded-xl bg-slate-50 text-slate-500 font-black text-sm">إلغاء</Button>
            </div>
          </form>
        </div>
      </div>
    );
  }
