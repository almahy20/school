import { useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import DataPagination from '@/components/ui/DataPagination';
import { 
  Phone, User, GraduationCap, Eye, Edit2, Save, X, Search, Users,
  Activity, Award, Star, BookOpen, ChevronRight, Filter, MoreHorizontal,
  Mail, Settings, Briefcase, ShieldCheck, XCircle, Clock, Link as LinkIcon, Copy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const PAGE_SIZE = 15;

interface TeacherProfile {
  id: string;
  full_name: string;
  phone: string | null;
  classes: { id: string; name: string }[];
}

async function fetchTeachersData(schoolId: string | null, isSuperAdmin: boolean) {
  const profileQuery = supabase.from('profiles').select('id, full_name, phone');
  const roleQuery = (supabase as any).from('user_roles').select('*').eq('role', 'teacher');
  const classQuery = supabase.from('classes').select('id, name, teacher_id');

  if (!isSuperAdmin && schoolId) {
    profileQuery.eq('school_id', schoolId);
    roleQuery.eq('school_id', schoolId);
    classQuery.eq('school_id', schoolId);
  }

  const [{ data: profiles }, { data: roles }, { data: classes }] = await Promise.all([
    profileQuery, roleQuery, classQuery
  ]);

  const active: TeacherProfile[] = (profiles || [])
    .filter(p => (roles || []).some((r: any) => r.user_id === p.id && r.approval_status === 'approved'))
    .map(p => ({
      ...p,
      classes: (classes || []).filter(c => c.teacher_id === p.id).map(c => ({ id: c.id, name: c.name }))
    }));

  const pending = (roles || [])
    .filter((r: any) => r.approval_status === 'pending')
    .map((r: any) => {
      const p = (profiles || []).find(prof => prof.id === r.user_id);
      return { ...r, full_name: p?.full_name, phone: p?.phone };
    });

  return { active, pending };
}

export default function TeachersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [schoolSlug, setSchoolSlug] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // ── React Query (cached 5 min) ──
  const { data, isLoading: loading } = useQuery({
    queryKey: ['teachers-page', user?.schoolId, user?.isSuperAdmin],
    queryFn: () => fetchTeachersData(user?.schoolId || null, !!user?.isSuperAdmin),
    enabled: !!(user?.schoolId || user?.isSuperAdmin),
    staleTime: 5 * 60 * 1000,
  });

  const teachers: TeacherProfile[] = data?.active || [];
  const pendingTeachers: any[] = data?.pending || [];

  // Load school slug for invite link
  useState(() => {
    if (!user?.schoolId) return;
    (supabase as any).from('schools').select('slug').eq('id', user.schoolId).single()
      .then(({ data: s }: any) => { if (s) setSchoolSlug(s.slug); });
  });

  const filtered = useMemo(() =>
    teachers.filter(t => (t.full_name || '').includes(search)),
    [teachers, search]
  );

  const totalItems = filtered.length;
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const handleSearch = (val: string) => { setSearch(val); setPage(1); };

  const handleAction = async (userId: string, status: 'approved' | 'rejected') => {
    setActionLoading(userId);
    try {
      const { error } = await (supabase as any).from('user_roles').update({ approval_status: status }).eq('id', userId);
      if (error) throw error;
      toast({ title: 'تم الحفظ', description: status === 'approved' ? 'تمت الموافقة على المعلم' : 'تم رفض الطلب' });
      queryClient.invalidateQueries({ queryKey: ['teachers-page', user?.schoolId, !!user?.isSuperAdmin] });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
    setActionLoading(null);
  };

  const copyLink = () => {
    const link = `${window.location.origin}/register/teachers/${schoolSlug}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'تم النسخ', description: 'تم نسخ رابط تسجيل المعلمين للحافظة' });
  };

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

        {/* Registration Link & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           <div className="md:col-span-1 premium-card p-5 border border-indigo-100 bg-indigo-50/50 flex flex-col justify-center items-start gap-3">
             <div className="flex items-center gap-2">
               <LinkIcon className="w-5 h-5 text-indigo-600" />
               <h3 className="font-black text-indigo-900 text-sm">رابط انضمام المعلمين</h3>
             </div>
             <p className="text-[10px] text-indigo-600/70 font-medium leading-relaxed">انسخ هذا الرابط وأرسله للمعلمين الجدد لإنشاء حساباتهم.</p>
             <Button onClick={copyLink} className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 text-xs gap-2 rounded-xl shadow-lg shadow-indigo-200">
               <Copy className="w-4 h-4" /> نسخ الرابط
             </Button>
           </div>
           
           <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-6">
             <KPIStat label="إجمالي المعلمين المعتمدين" value={teachers.length} icon={GraduationCap} color="indigo" />
             <KPIStat label="الفصول المغطاة" value={teachers.reduce((acc, t) => acc + t.classes.length, 0)} icon={Briefcase} color="emerald" />
             <KPIStat label="طلبات الانضمام" value={pendingTeachers.length} icon={Clock} color="amber" />
           </div>
        </div>

        {/* Pending Approvals */}
        {pendingTeachers.length > 0 && (
          <div className="premium-card border-amber-100 bg-amber-50/10 p-6 overflow-hidden relative">
            <h2 className="text-lg font-black text-amber-900 flex items-center gap-2 mb-6"><Clock className="w-5 h-5 text-amber-600" /> طلبات انضمام في انتظار المراجعة</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {pendingTeachers.map(u => (
                 <div key={u.id} className="bg-white rounded-2xl border border-amber-100 p-5 shadow-sm hover:shadow-md transition-all">
                    <h3 className="font-bold text-slate-900 text-sm mb-1">{u.full_name}</h3>
                    <p className="text-xs text-slate-500 mb-4" dir="ltr">{u.phone}</p>
                    <div className="flex gap-2">
                      <Button onClick={() => handleAction(u.id, 'approved')} disabled={actionLoading === u.id} className="flex-1 h-9 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white font-bold text-xs gap-1.5 p-0">
                        <ShieldCheck className="w-3.5 h-3.5" /> قبول
                      </Button>
                      <Button onClick={() => handleAction(u.id, 'rejected')} disabled={actionLoading === u.id} className="flex-1 h-9 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white font-bold text-xs gap-1.5 p-0">
                        <XCircle className="w-3.5 h-3.5" /> رفض
                      </Button>
                    </div>
                 </div>
              ))}
            </div>
          </div>
        )}

        {/* Search & Filter - Scaled Down */}
        <div className="relative group ml-auto w-full max-w-md">
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
          <Input 
            placeholder="ابحث عن معلم..." 
            value={search}
            onChange={e => handleSearch(e.target.value)}
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
          <>
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                {totalItems} معلم — الصفحة {page}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {paginated.map(t => (
                <TeacherCard key={t.id} teacher={t} onClick={() => navigate(`/teachers/${t.id}`)} />
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
