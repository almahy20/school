import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  Phone, User, GraduationCap, Eye, Edit2, Save, X, Search, Users,
  Activity, Award, Star, BookOpen, ChevronRight, Filter, MoreHorizontal,
  Mail, Settings, Briefcase
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface TeacherProfile {
  id: string;
  full_name: string;
  phone: string | null;
  classes: { id: string; name: string }[];
}

export default function TeachersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchTeachers = useCallback(async () => {
    if (!user?.schoolId) return;
    const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, full_name, phone').eq('school_id', user.schoolId);
    const { data: roles, error: rErr } = await supabase.from('user_roles').select('user_id').eq('role', 'teacher').eq('school_id', user.schoolId);
    const { data: classes, error: cErr } = await supabase.from('classes').select('id, name, teacher_id').eq('school_id', user.schoolId);

    if (pErr || rErr || cErr) {
      toast({ title: 'خطأ', description: 'فشل في تحميل بيانات المعلمين', variant: 'destructive' });
      setLoading(false); return;
    }

    const teacherIds = roles.map(r => r.user_id);
    const enriched = (profiles || [])
      .filter(p => teacherIds.includes(p.id))
      .map(p => ({
        ...p,
        classes: (classes || []).filter(c => c.teacher_id === p.id).map(c => ({ id: c.id, name: c.name })),
      }));
    
    setTeachers(enriched);
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchTeachers(); }, [fetchTeachers]);

  const filtered = teachers.filter(t => t.full_name.includes(search));

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1400px] mx-auto text-right pb-10">
        {/* Premium Header - Scaled Down */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/40 backdrop-blur-md p-8 rounded-[40px] border border-white/50 shadow-xl shadow-slate-200/10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="w-1.5 h-7 bg-indigo-600 rounded-full" />
               <h1 className="text-2xl font-black text-slate-900 tracking-tight">إدارة الكادر التعليمي</h1>
            </div>
            <p className="text-slate-500 font-medium text-sm pr-4">إحصائيات الهيئة التدريسية وتوزيع الأعباء الأكاديمية</p>
          </div>
          
          <div className="flex items-center gap-4">
             <Button className="h-11 px-6 rounded-xl bg-slate-900 text-white font-black text-xs shadow-xl shadow-slate-900/10 hover:scale-[1.02] transition-all gap-3">
               تصدير التقارير
             </Button>
          </div>
        </header>

        {/* Stats Summary - Scaled Down */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <KPIStat label="إجمالي المعلمين" value={teachers.length} icon={GraduationCap} color="indigo" />
           <KPIStat label="الفصول المغطاة" value={teachers.reduce((acc, t) => acc + t.classes.length, 0)} icon={Briefcase} color="emerald" />
           <KPIStat label="نسبة الأداء" value="96%" icon={Star} color="amber" />
        </div>

        {/* Search & Filter - Scaled Down */}
        <div className="relative group ml-auto w-full max-w-md">
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
          <Input 
            placeholder="ابحث عن معلم..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-12 pr-12 pl-6 rounded-[20px] border-none bg-white text-sm font-bold shadow-sm transition-all focus:ring-4 focus:ring-indigo-600/5" 
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-slate-300 font-black tracking-widest text-[10px] uppercase">جاري فرز الكادر التعليمي</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 p-24 text-center rounded-[48px] shadow-sm">
            <div className="w-20 h-20 rounded-[32px] bg-slate-50 flex items-center justify-center mx-auto mb-6 text-slate-200">
              <User className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2">لا يوجد معلمون</h2>
            <p className="text-slate-400 font-medium text-sm">لم يتم العثور على أي نتائج تطابق بحثك.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map(t => (
              <TeacherCard key={t.id} teacher={t} onClick={() => navigate(`/teachers/${t.id}`)} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function KPIStat({ label, value, icon: Icon, color }: any) {
  const configs: any = {
    indigo: "bg-white text-slate-900 border-slate-100",
    emerald: "bg-emerald-600 text-white border-emerald-600 shadow-emerald-200/40",
    amber: "bg-amber-500 text-white border-amber-500 shadow-amber-200/40",
  };
  return (
    <div className={cn("premium-card p-5 border flex items-center gap-5 transition-all hover:translate-y-[-2px]", configs[color])}>
       <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-inner", color === 'indigo' ? "bg-slate-50 text-indigo-600" : "bg-white/20 text-white")}>
          <Icon className="w-5 h-5" />
       </div>
       <div>
          <p className={cn("text-[9px] font-black uppercase tracking-widest opacity-60 mb-0.5", color === 'indigo' ? "text-slate-400" : "text-white")}>{label}</p>
          <h3 className="text-xl font-black">{value}</h3>
       </div>
    </div>
  );
}

function TeacherCard({ teacher, onClick }: { teacher: TeacherProfile; onClick: () => void }) {
  return (
    <div className="group premium-card p-0 overflow-hidden hover:translate-y-[-4px] transition-all duration-500 text-right cursor-pointer" onClick={onClick}>
      <div className="p-6 space-y-6">
         <div className="flex items-center gap-4">
            <Avatar className="w-12 h-12 rounded-xl group-hover:rotate-3 transition-transform">
               <AvatarFallback className="bg-slate-50 text-slate-400 text-sm font-black border border-slate-100">{teacher.full_name[0]}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
               <h3 className="text-lg font-black text-slate-900 leading-none mb-1.5 group-hover:text-indigo-600 truncate">{teacher.full_name}</h3>
               <div className="flex items-center gap-2 text-slate-400">
                  <Phone className="w-3 h-3" />
                  <span className="text-[10px] font-black tracking-tight">{teacher.phone || 'غير مسجل'}</span>
               </div>
            </div>
         </div>

         <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
             <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                <span className="text-slate-400">الفصول المسندة</span>
                <span className="text-indigo-600">{teacher.classes.length} فصول</span>
             </div>
             <div className="flex flex-wrap gap-1.5">
                {teacher.classes.slice(0, 2).map(c => (
                  <Badge key={c.id} variant="secondary" className="bg-white border-slate-100 text-[8px] font-black px-2 py-0.5 rounded-lg">
                    {c.name}
                  </Badge>
                ))}
                {teacher.classes.length > 2 && (
                  <span className="text-[8px] font-black text-slate-300 self-center">+{teacher.classes.length - 2}</span>
                )}
             </div>
          </div>

          <div className="flex gap-4 pt-2 border-t border-slate-50">
             <Button onClick={onClick} className="flex-1 h-11 rounded-xl bg-slate-900 text-white font-black group-hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 text-xs">
                الملف الشخصي
             </Button>
          </div>
      </div>
    </div>
  );
}

// ─── Edit Teacher Modal ───────────────────────────────────────────────────────
export function EditTeacherModal({ teacher, onClose }: { teacher: TeacherProfile; onClose: () => void }) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState(teacher.full_name);
  const [phone, setPhone] = useState(teacher.phone || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    setLoading(true);
    setError('');
    
    const { error } = await supabase.from('profiles').update({
      full_name: fullName.trim(),
      phone: phone.trim().replace(/\D/g, '') || null,
    }).eq('id', teacher.id);
    
    if (error) {
      setError(error.message);
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'تم الحفظ بنجاح' });
      onClose();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-right animate-in fade-in" onClick={onClose}>
      <div className="bg-white border border-slate-100 shadow-2xl w-full max-w-lg p-8 rounded-[40px] animate-in zoom-in-95 relative overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-bl-[80px]" />
        <h2 className="text-2xl font-black text-slate-900 mb-8 tracking-tight relative z-10">تعديل بيانات المعلم</h2>
        
        <form onSubmit={handleSave} className="space-y-5 relative z-10">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">الاسم الكامل *</label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)}
              className="h-12 px-5 rounded-xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-primary/10 font-bold text-sm" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">رقم الهاتف</label>
            <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              className="h-12 px-5 rounded-xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-primary/10 font-bold text-sm"
              placeholder="05xxxxxxxx" dir="ltr" />
          </div>

          {error && <p className="text-rose-500 text-[10px] font-black bg-rose-50 p-3 rounded-xl">{error}</p>}
          
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading}
              className="flex-1 h-12 rounded-xl bg-slate-900 text-white font-black shadow-lg hover:bg-primary transition-all text-sm">
              {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </Button>
            <Button type="button" onClick={onClose} variant="ghost"
              className="flex-1 h-12 rounded-xl bg-slate-50 text-slate-500 font-black text-sm">إلغاء</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
