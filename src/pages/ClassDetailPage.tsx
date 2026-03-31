import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowRight, School, Users, Edit2, Trash2, 
  User, GraduationCap, ChevronLeft, MoreHorizontal,
  Calendar, Clock, Shield, Award, Activity, Search, Filter
} from 'lucide-react';
import { EditClassModal } from './ClassesPage';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';

interface ClassItem {
  id: string;
  name: string;
  grade_level: string | null;
  teacher_id: string | null;
  teacher_name?: string;
  student_count?: number;
}

export default function ClassDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [classItem, setClassItem] = useState<ClassItem | null>(null);
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [{ data: classData, error: cErr }, { data: profiles }, { data: studentsData }] = await Promise.all([
        supabase.from('classes').select('*').eq('id', id).single(),
        supabase.from('profiles').select('id, full_name').eq('school_id', user?.schoolId),
        supabase.from('students').select('id, name, class_id').eq('class_id', id).eq('school_id', user?.schoolId).order('name'),
      ]);
      if (cErr) throw cErr;
      const teacherName = profiles?.find(p => p.id === classData.teacher_id)?.full_name || 'غير محدد';
      const enriched: ClassItem = {
        ...classData,
        teacher_name: teacherName,
        student_count: (studentsData || []).length,
      };
      setClassItem(enriched);
      setStudents((studentsData || []).map((s: any) => ({ id: s.id, name: s.name })));

      const { data: teacherRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'teacher').eq('school_id', user?.schoolId);
      const teacherIds = (teacherRoles || []).map(r => r.user_id);
      setTeachers((profiles || []).filter(p => teacherIds.includes(p.id)) as any);
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      navigate('/classes');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDelete = async () => {
    if (!id || !confirm('هل أنت متأكد من حذف هذا الفصل؟')) return;
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'تم الحذف بنجاح' }); navigate('/classes');
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">جاري تجهيز سجل الفصل الدراسي</p>
        </div>
      </AppLayout>
    );
  }

  if (!classItem) return null;

  const filteredStudents = students.filter(s => s.name.includes(search));

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 max-w-[1400px] mx-auto text-right pb-14 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        {/* Premium Header - Scaled Down */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white/40 backdrop-blur-md p-8 rounded-[40px] border border-white/50 shadow-xl shadow-slate-200/10 relative overflow-hidden">
          <div className="flex items-center gap-6 relative z-10">
            <button onClick={() => navigate('/classes')}
              className="w-11 h-11 rounded-[14px] bg-white border border-slate-100 text-slate-400 hover:text-slate-900 flex items-center justify-center transition-all active:scale-95 shadow-sm shrink-0">
               <ArrowRight className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-5">
               <div className="w-16 h-16 rounded-[22px] bg-indigo-600 text-white flex items-center justify-center shadow-2xl shadow-indigo-200 shrink-0">
                  <School className="w-8 h-8" />
               </div>
               <div className="min-w-0">
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1.5 truncate">فصل {classItem.name}</h1>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-indigo-600/5 text-indigo-600 border-none font-black text-[9px] uppercase tracking-widest px-3 py-1 rounded-full">
                       {classItem.grade_level || 'مرحلة أكاديمية'}
                    </Badge>
                    <span className="text-slate-400 text-[10px] font-bold border-r pr-3 border-slate-200 tracking-tight">معرف الفصل: #{classItem.id.slice(0, 5)}</span>
                  </div>
               </div>
            </div>
          </div>
          
          {user?.role === 'admin' && (
            <div className="flex items-center gap-3 relative z-10">
              <Button onClick={() => setShowEdit(true)}
                className="h-11 px-6 rounded-xl bg-white border border-slate-200 text-slate-900 font-black hover:bg-slate-50 transition-all shadow-sm gap-2 text-xs">
                <Edit2 className="w-4 h-4" /> تعديل البيانات
              </Button>
              <Button onClick={handleDelete} variant="ghost"
                className="h-11 w-11 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 transition-all shadow-sm flex items-center justify-center shrink-0">
                <Trash2 className="w-4.5 h-4.5" />
              </Button>
            </div>
          )}
        </header>

        {/* Stats Grid - Scaled Down */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <StatsCard title="إجمالي الطلاب" value={classItem.student_count} icon={Users} color="indigo" />
           <StatsCard title="المعلم المسؤول" value={classItem.teacher_name} icon={User} color="emerald" smallValue />
           <StatsCard title="نسبة الحضور" value="94%" icon={Activity} color="amber" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <section className="premium-card p-8 space-y-6">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-50 pb-6">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                        <Users className="w-5 h-5" />
                     </div>
                     <h2 className="text-xl font-black text-slate-900">قائمة طلاب الفصل</h2>
                  </div>
                  
                  <div className="relative group w-full sm:w-64">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                    <input 
                      type="text" 
                      placeholder="بحث سريع..." 
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="w-full pr-10 pl-4 py-2 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-indigo-600/5 transition-all text-xs font-bold" 
                    />
                  </div>
               </div>

               {filteredStudents.length === 0 ? (
                 <div className="p-16 text-center bg-slate-50 rounded-[32px] border border-dashed border-slate-200">
                    <Users className="w-14 h-14 text-slate-100 mx-auto mb-4" />
                    <p className="text-sm font-black text-slate-900"> القائمة فارغة </p>
                    <p className="text-[10px] text-slate-400 font-medium">لا يوجد طلاب مسجلين حالياً</p>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredStudents.map((s, idx) => (
                      <div key={s.id} onClick={() => navigate(`/students/${s.id}`)} className="p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-lg transition-all duration-300 group flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-[10px] font-black text-slate-300 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm shrink-0">
                            {idx + 1}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors truncate">{s.name}</h3>
                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mt-1">طالب منتظم</p>
                          </div>
                        </div>
                        <ChevronLeft className="w-4 h-4 text-slate-200 group-hover:text-indigo-600 transition-colors" />
                      </div>
                    ))}
                 </div>
               )}
            </section>
          </div>

          <div className="space-y-8">
             <section className="bg-slate-900 rounded-[40px] p-8 space-y-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.05),transparent)] pointer-events-none" />
                <div className="flex items-center gap-3 relative z-10">
                   <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
                      <Shield className="w-5 h-5" />
                   </div>
                   <h2 className="text-lg font-black text-white leading-none">الإحصائيات الإدارية</h2>
                </div>

                <div className="space-y-6 relative z-10">
                   <div className="p-5 rounded-[24px] bg-white/5 border border-white/5">
                      <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-3">سعة الفصل الاستيعابية</p>
                      <div className="space-y-3">
                         <div className="flex justify-between items-end">
                            <span className="text-2xl font-black text-white">{students.length} <span className="text-[10px] font-bold text-white/40">طالب</span></span>
                            <span className="text-[9px] font-bold text-indigo-400 uppercase">90% ممتلئ</span>
                         </div>
                         <Progress value={90} className="h-1.5 bg-white/10" />
                      </div>
                   </div>
                   
                   <div className="grid grid-cols-1 gap-3">
                      <div className="p-5 rounded-[24px] bg-white/5 border border-white/5 flex items-center gap-4">
                         <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
                            <Calendar className="w-4.5 h-4.5" />
                         </div>
                         <div>
                            <p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-0.5">السنة الدراسية</p>
                            <p className="text-[10px] font-black text-white">2024 / 2025</p>
                         </div>
                      </div>
                   </div>

                   <Button className="w-full h-13 rounded-xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all text-xs shadow-xl shadow-indigo-900/40 relative z-10">طباعة الكشف الأكاديمي</Button>
                </div>
             </section>
          </div>
        </div>
      </div>

      {showEdit && classItem && (
        <EditClassModal 
          classItem={classItem} 
          teachers={teachers} 
          onClose={() => setShowEdit(false)} 
          onSuccess={() => { setShowEdit(false); loadData(); }}
        />
      )}
    </AppLayout>
  );
}

function StatsCard({ title, value, icon: Icon, color, smallValue }: any) {
  const configs: any = {
    indigo: "bg-slate-900 text-white border-slate-900 shadow-xl shadow-slate-200",
    emerald: "bg-emerald-600 text-white border-emerald-600 shadow-xl shadow-emerald-200",
    amber: "bg-amber-500 text-white border-amber-500 shadow-xl shadow-amber-200",
  };
  return (
    <div className={cn("premium-card p-6 flex flex-col justify-between border h-40", configs[color])}>
       <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-inner bg-white/20 text-white")}>
          <Icon className="w-5 h-5" />
       </div>
       <div className="mt-4">
          <p className="text-[8px] font-black uppercase tracking-widest mb-0.5 opacity-60">{title}</p>
          <h3 className={cn("font-black tracking-tight leading-none", smallValue ? "text-xl" : "text-3xl")}>{value}</h3>
       </div>
    </div>
  );
}
