import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowRight, User, Users, GraduationCap, Phone, Calendar, 
  School, Info, Mail, Shield, Edit2, Trash2,
  Award, Activity, Briefcase, ChevronLeft, MoreHorizontal,
  MailOpen, MapPin, CheckCircle, Clock
} from 'lucide-react';
import { EditTeacherModal } from './TeachersPage';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';

interface Teacher {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  specialization?: string | null;
  created_at: string;
}

export default function TeacherDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [stats, setStats] = useState({ studentCount: 0, curriculumProgress: 0 });
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: teacherData, error: tErr } = await supabase.from('profiles').select('*').eq('id', id).single();
      if (tErr) throw tErr;
      setTeacher(teacherData);

      const { data: classesData } = await supabase.from('classes').select('id, name').eq('school_id', authUser?.schoolId).eq('teacher_id', id);
      const enrichedClasses = classesData || [];
      setClasses(enrichedClasses);

      // Fetch Real Stats
      if (enrichedClasses.length > 0) {
        const classIds = enrichedClasses.map(c => c.id);
        const [{ count: studentCount }, { data: curriculumData }] = await Promise.all([
          supabase.from('students').select('*', { count: 'exact', head: true }).in('class_id', classIds),
          supabase.rpc('get_class_curriculum_status', { p_class_id: classIds[0] }) // Get for first class as sample
        ]);

        const avgProgress = Array.isArray(curriculumData) 
          ? Math.round(curriculumData.reduce((acc: number, s: any) => acc + (s.progress || 0), 0) / (curriculumData.length || 1))
          : 0;

        setStats({
          studentCount: studentCount || 0,
          curriculumProgress: avgProgress
        });
      }
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      navigate('/teachers');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDelete = async () => {
    if (!id || !confirm('هل أنت متأكد من حذف هذا المعلم؟')) return;
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'تم الحذ بنجاح' }); navigate('/teachers');
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">جاري تحميل الملف الشخصي للمعلم</p>
        </div>
      </AppLayout>
    );
  }

  if (!teacher) return null;

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 max-w-[1400px] mx-auto text-right pb-14 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        {/* Premium Header - Scaled Down */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white/40 backdrop-blur-md p-8 rounded-[40px] border border-white/50 shadow-xl shadow-slate-200/10 relative overflow-hidden">
          <div className="flex items-center gap-6 relative z-10">
            <button onClick={() => navigate('/teachers')}
              className="w-11 h-11 rounded-[14px] bg-white border border-slate-100 text-slate-400 hover:text-slate-900 flex items-center justify-center transition-all active:scale-95 shadow-sm shrink-0">
               <ArrowRight className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-5">
               <Avatar className="w-16 h-16 rounded-[22px] border-2 border-white shadow-2xl shrink-0">
                  <AvatarFallback className="bg-indigo-600 text-white text-2xl font-black">{teacher.full_name[0]}</AvatarFallback>
               </Avatar>
               <div className="min-w-0">
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1.5 truncate">{teacher.full_name}</h1>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-white border-slate-100 text-slate-400 font-black text-[9px] uppercase tracking-widest px-3 py-1 rounded-full">معلم ممارس</Badge>
                    <span className="text-slate-400 text-[10px] font-bold border-r pr-3 border-slate-200 tracking-tight">عضو منذ {new Date(teacher.created_at).getFullYear()}</span>
                  </div>
               </div>
            </div>
          </div>
          
          {authUser?.role === 'admin' && (
            <div className="flex items-center gap-3 relative z-10">
              <Button onClick={() => setShowEdit(true)}
                className="h-11 px-6 rounded-xl bg-white border border-slate-200 text-slate-900 font-black hover:bg-slate-50 transition-all shadow-sm gap-2 text-xs">
                <Edit2 className="w-4 h-4" /> تعديل السجل
              </Button>
              <Button onClick={handleDelete} variant="ghost"
                className="h-11 w-11 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 transition-all shadow-sm flex items-center justify-center shrink-0">
                <Trash2 className="w-4.5 h-4.5" />
              </Button>
            </div>
          )}
        </header>

        {/* Status Metrics - Scaled Down */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           <StatsCard title="الفصول الدراسية" value={classes.length} icon={School} color="indigo" />
           <StatsCard title="إجمالي الطلاب" value={stats.studentCount} icon={Users} color="emerald" />
           <StatsCard title="تغطية المنهج" value={`${stats.curriculumProgress}%`} icon={BookOpen} color="amber" />
           <StatsCard title="الحالة" value="نشط" icon={CheckCircle} color="slate" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 space-y-8">
              <section className="premium-card p-8 space-y-6">
                 <div className="flex items-center gap-3 border-b border-slate-50 pb-6">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                       <School className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-black text-slate-900">الفصول المسؤولة</h2>
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {classes.length === 0 ? (
                      <div className="col-span-2 p-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                         <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">لا توجد فصول مسندة حالياً</p>
                      </div>
                    ) : classes.map(c => (
                      <div key={c.id} onClick={() => navigate(`/classes/${c.id}`)} className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-md transition-all cursor-pointer">
                         <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                               <CheckCircle className="w-4.5 h-4.5" />
                            </div>
                            <span className="text-xs font-black text-slate-900 tracking-tight">{c.name}</span>
                         </div>
                         <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:translate-x-[-4px] transition-transform" />
                      </div>
                    ))}
                 </div>
              </section>

              <section className="premium-card p-8 space-y-6">
                 <div className="flex items-center gap-3 border-b border-slate-50 pb-6">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                       <Activity className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-black text-slate-900">مؤشرات الأداء (متوسط)</h2>
                 </div>
                 <div className="space-y-6">
                    <LoadProgress label="متوسط تقدم المنهج" percentage={stats.curriculumProgress} />
                    <LoadProgress label="تفاعل الفصول" percentage={90} />
                 </div>
              </section>
           </div>

           {/* Sidebar Info - Scaled Down */}
           <div className="space-y-8">
              <section className="bg-slate-900 rounded-[40px] p-8 space-y-8 shadow-2xl relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.05),transparent)] pointer-events-none" />
                 <div className="flex items-center gap-3 relative z-10">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
                       <Shield className="w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-black text-white leading-none">معلومات الاتصال</h2>
                 </div>

                 <div className="space-y-4 relative z-10">
                    <ContactItem icon={Phone} label="رقم الجوال" value={teacher.phone || 'غير مسجل'} />
                    <ContactItem icon={Mail} label="البريد المؤسسي" value={teacher.email || '—'} />
                    <ContactItem icon={MapPin} label="المكتب" value="الجناح الأكاديمي، مكتب 12" />
                 </div>

                 <Button className="w-full h-13 rounded-xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all text-xs relative z-10 shadow-xl shadow-indigo-900/40">تنزيل تقرير الأداء</Button>
              </section>
           </div>
        </div>
      </div>

      {showEdit && (
        <EditTeacherModal 
          teacher={{ ...teacher, classes }}
          onClose={() => { setShowEdit(false); loadData(); }} 
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
    slate: "bg-white text-slate-900 border-slate-100",
  };
  return (
    <div className={cn("premium-card p-6 flex flex-col justify-between border h-40", configs[color])}>
       <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-inner", color === 'slate' ? "bg-slate-50 text-slate-400" : "bg-white/20 text-white")}>
          <Icon className="w-5 h-5" />
       </div>
       <div className="mt-4">
          <p className={cn("text-[8px] font-black uppercase tracking-widest mb-0.5", color === 'slate' ? "text-slate-400" : "opacity-60")}>{title}</p>
          <h3 className={cn("font-black tracking-tight leading-none", smallValue ? "text-xl" : "text-3xl")}>{value}</h3>
       </div>
    </div>
  );
}

function LoadProgress({ label, percentage }: { label: string; percentage: number }) {
  return (
    <div className="space-y-2">
       <div className="flex justify-between items-end">
          <span className="text-xs font-black text-slate-700">{label}</span>
          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{percentage}%</span>
       </div>
       <Progress value={percentage} className="h-1.5 bg-slate-100" />
    </div>
  );
}

function ContactItem({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center gap-4 group">
       <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white/40 group-hover:bg-white/10 group-hover:text-white transition-all shrink-0">
          <Icon className="w-4 h-4" />
       </div>
       <div className="min-w-0 text-right">
          <p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-0.5">{label}</p>
          <p className="text-[10px] font-black text-white/80 truncate leading-none">{value}</p>
       </div>
    </div>
  );
}
