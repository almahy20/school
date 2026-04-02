import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowRight, GraduationCap, School, BookOpen, Calendar, 
  Clock, CheckCircle, Activity, Award, User, Mail, 
  Phone, MapPin, Edit2, Trash2, ChevronLeft, MoreHorizontal,
  LayoutGrid, Shield, Info, Star
} from 'lucide-react';
import { EditStudentModal } from './StudentsPage';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface Student {
  id: string;
  name: string;
  class_id: string | null;
  parent_phone: string | null;
  created_at: string;
  classes?: { name: string; grade_level: string | null };
}

export default function StudentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [parents, setParents] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);

  const fetchData = async () => {
    const { data: studentData, error } = await supabase.from('students').select('*, classes(*)').eq('id', id).single();
    if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); navigate('/students'); return; }
    setStudent(studentData);
    
    // Fetch classes and parents for the edit modal
    const [{ data: classesData }, { data: rolesData }] = await Promise.all([
      supabase.from('classes').select('id, name').eq('school_id', user?.schoolId),
      supabase.from('user_roles').select('user_id').eq('role', 'parent').eq('school_id', user?.schoolId),
    ]);
    
    setClasses(classesData || []);
    
    const parentIds = (rolesData || []).map(r => r.user_id);
    if (parentIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles').select('id, full_name').in('id', parentIds).order('full_name');
      setParents(profilesData || []);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [id, navigate, toast]);

  const handleDelete = async () => {
    if (!id || !confirm('Ù‡Ù„ Ø£Ù†Øª Ù…ØªØ£ÙƒØ¯ Ù…Ù† Ø­Ø°Ù Ù‡Ø°Ø§ Ø§Ù„Ø·Ø§Ù„Ø¨ØŸ')) return;
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'ØªÙ… Ø§Ù„Ø­Ø°Ù Ø¨Ù†Ø¬Ø§Ø­' }); navigate('/students');
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">جاري تحميل سجل الطالب الأكاديمي</p>
        </div>
      </AppLayout>
    );
  }

  if (!student) return null;

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 max-w-[1400px] mx-auto text-right pb-14 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        {/* Premium Header - Scaled Down */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white/40 backdrop-blur-md p-8 rounded-[40px] border border-white/50 shadow-xl shadow-slate-200/10 relative overflow-hidden">
          <div className="flex items-center gap-6 relative z-10">
            <button onClick={() => navigate('/students')}
              className="w-11 h-11 rounded-[14px] bg-white border border-slate-100 text-slate-400 hover:text-slate-900 flex items-center justify-center transition-all active:scale-95 shadow-sm shrink-0">
               <ArrowRight className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-5">
               <div className="w-16 h-16 rounded-[22px] bg-indigo-600 text-white flex items-center justify-center shadow-2xl shadow-indigo-200 shrink-0">
                  <User className="w-8 h-8" />
               </div>
               <div className="min-w-0">
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1.5 truncate">{student.name}</h1>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-indigo-600/5 text-indigo-600 border-none font-black text-[9px] uppercase tracking-widest px-3 py-1 rounded-full">
                       {student.classes?.name || 'غير مسجل بفصل'}
                    </Badge>
                    <span className="text-slate-400 text-[10px] font-bold border-r pr-3 border-slate-200">معرف الطالب: #{student.id.slice(0, 5)}</span>
                  </div>
               </div>
            </div>
          </div>
          
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
        </header>

        {/* Stats Grid - Scaled Down */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           <StatsCard title="المعدل التراكمي" value="98.5%" icon={Award} color="indigo" />
           <StatsCard title="نسبة الحضور" value="94%" icon={Activity} color="emerald" />
           <StatsCard title="السلوك العملي" value="امتياز" icon={Star} color="amber" smallValue />
           <StatsCard title="الدرجات المرصودة" value="12" icon={BookOpen} color="slate" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 space-y-8">
              <section className="premium-card p-8 space-y-6">
                 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-50 pb-6">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                          <CheckCircle className="w-5 h-5" />
                       </div>
                       <h2 className="text-xl font-black text-slate-900">البيانات الأكاديمية</h2>
                    </div>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-none font-black px-4 py-1.5 rounded-full text-[10px]">حالة الطالب: نشط</Badge>
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoRow label="الفصل المسجل" value={student.classes?.name || 'غير محدد'} icon={School} />
                    <InfoRow label="المرحلة الدراسية" value={student.classes?.grade_level || 'غير محدد'} icon={GraduationCap} />
                    <InfoRow label="تاريخ الانضمام" value={new Date(student.created_at).toLocaleDateString('ar-EG')} icon={Calendar} />
                    <InfoRow label="معرف ولي الأمر" value={student.parent_phone || 'لم يتم الربط'} icon={Phone} />
                 </div>
              </section>

              <section className="premium-card p-8 space-y-6">
                 <div className="flex items-center gap-3 border-b border-slate-50 pb-6">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                       <Activity className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-black text-slate-900">مؤشرات الأداء</h2>
                 </div>
                 <div className="space-y-6">
                    <PerformanceMetric label="اللغة العربية" percentage={95} />
                    <PerformanceMetric label="الرياضيات" percentage={88} />
                    <PerformanceMetric label="التربية الإسلامية" percentage={100} />
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
                    <h2 className="text-lg font-black text-white leading-none">الملف الإداري</h2>
                 </div>

                 <div className="space-y-4 relative z-10">
                    <AdminDetail icon={Mail} label="البريد الإلكتروني" value="أحمد@مدرسة.كوم" />
                    <AdminDetail icon={Phone} label="رقم التواصل" value="05xxxxxxxx" />
                    <AdminDetail icon={MapPin} label="العنوان" value="الرياض، المملكة العربية السعودية" />
                 </div>

                 <Button className="w-full h-13 rounded-xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all text-xs relative z-10 shadow-xl shadow-indigo-900/40">تنزيل التقرير الأكاديمي</Button>
              </section>
           </div>
        </div>
      </div>

      {showEdit && (
        <EditStudentModal 
          student={student} 
          classes={classes} 
          parents={parents}
          user={user}
          onClose={() => setShowEdit(false)} 
          onSuccess={() => { setShowEdit(false); fetchData(); }}
        />
      )}
    </AppLayout>
  );
}

function StatsCard({ title, value, icon: Icon, color, smallValue }: any) {
  const configs: any = {
    indigo: "bg-slate-900 text-white border-slate-900",
    emerald: "bg-emerald-600 text-white border-emerald-600",
    amber: "bg-amber-500 text-white border-amber-500",
    slate: "bg-white text-slate-900 border-slate-100",
  };
  return (
    <div className={cn("premium-card p-6 flex flex-col justify-between border shadow-xl h-40", configs[color])}>
       <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color === 'slate' ? "bg-slate-50 text-slate-400" : "bg-white/20 text-white")}>
          <Icon className="w-5 h-5" />
       </div>
       <div className="mt-4">
          <p className={cn("text-[8px] font-black uppercase tracking-widest mb-0.5", color === 'slate' ? "text-slate-400" : "opacity-60")}>{title}</p>
          <h3 className={cn("font-black tracking-tight leading-none", smallValue ? "text-xl" : "text-3xl")}>{value}</h3>
       </div>
    </div>
  );
}

function InfoRow({ label, value, icon: Icon }: any) {
  return (
    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-4 transition-all hover:bg-white hover:shadow-sm">
       <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center text-slate-400 shadow-sm shrink-0">
          <Icon className="w-4.5 h-4.5" />
       </div>
       <div className="min-w-0">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
          <p className="text-xs font-black text-slate-900 truncate">{value}</p>
       </div>
    </div>
  );
}

function PerformanceMetric({ label, percentage }: { label: string; percentage: number }) {
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

function AdminDetail({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center gap-4 group">
       <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white/40 group-hover:bg-white/10 group-hover:text-white transition-all shrink-0">
          <Icon className="w-4 h-4" />
       </div>
       <div className="min-w-0">
          <p className="text-[8px] font-black text-white/30 uppercase tracking-widest mb-0.5">{label}</p>
          <p className="text-[10px] font-black text-white/80 truncate leading-none">{value}</p>
       </div>
    </div>
  );
}

