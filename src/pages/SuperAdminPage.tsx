import { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Building2, CheckCircle2, XCircle, Users, Activity, Loader2, Plus, Search, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

interface School {
  id: string;
  name: string;
  status: 'active' | 'suspended';
  created_at: string;
  subscription_date: string;
  students_count?: number;
}

export default function SuperAdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (user && !user.isSuperAdmin) {
      navigate('/');
      return;
    }

    const fetchSchools = async () => {
      setLoading(true);
      const { data: schoolsData, error } = await (supabase as any)
        .from('schools')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        toast({ title: 'خطأ في التحميل', description: error.message, variant: 'destructive' });
      } else {
        // Here we could fetch the count of students per school in a real app, 
        // but for now we'll just mock it or skip it to save complex queries.
        setSchools(schoolsData as School[]);
      }
      setLoading(false);
    };

    fetchSchools();
  }, [user, navigate, toast]);

  const toggleStatus = async (schoolId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const { error } = await (supabase as any).from('schools').update({ status: newStatus }).eq('id', schoolId);
    
    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } else {
      setSchools(prev => prev.map(s => s.id === schoolId ? { ...s, status: newStatus } : s));
      toast({ title: 'تم تحديث حالة المدرسة بنجاح' });
    }
  };

  const filtered = schools.filter(s => s.name.includes(search));

  const stats = {
    total: schools.length,
    active: schools.filter(s => s.status === 'active').length,
    suspended: schools.filter(s => s.status === 'suspended').length,
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1400px] mx-auto text-right pb-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900 text-white p-8 rounded-[40px] shadow-2xl">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
               <ShieldAlert className="w-8 h-8 text-rose-500" />
               <h1 className="text-2xl font-black tracking-tight">إدارة المنصة المركزية (Super Admin)</h1>
            </div>
            <p className="text-slate-400 font-medium text-sm pr-11">إدارة اشتراكات المدارس، وتفعيل أو إيقاف الخدمات</p>
          </div>
          
          <div className="flex items-center gap-4">
             <Button onClick={() => setShowAddModal(true)} className="h-11 px-6 rounded-xl bg-white text-slate-900 font-black text-xs hover:bg-slate-100 transition-all gap-3 shadow-xl">
               <Plus className="w-4 h-4" /> إضافة مدرسة جديدة
             </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <StatCard title="إجمالي المدارس المشتركة" value={stats.total} icon={Building2} color="indigo" />
           <StatCard title="المدارس النشطة" value={stats.active} icon={CheckCircle2} color="emerald" />
           <StatCard title="المدارس الموقوفة" value={stats.suspended} icon={XCircle} color="rose" />
        </div>

        <div className="flex items-center justify-between gap-4">
           <div className="relative group w-full max-w-xl text-right">
              <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
              <Input 
                placeholder="ابحث باسم المدرسة..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-12 pr-12 pl-6 rounded-[20px] border-slate-200 bg-white text-sm font-bold shadow-sm transition-all focus:ring-4 focus:ring-indigo-600/5" 
              />
           </div>
        </div>

        <div className="premium-card p-0 overflow-hidden shadow-xl border border-slate-100">
           <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">سجل المدارس المسجلة</h2>
           </div>

           <div className="divide-y divide-slate-100 overflow-x-auto">
              <div className="min-w-[800px]">
                 <div className="grid grid-cols-5 px-8 py-4 bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <div className="col-span-2">المدرسة</div>
                    <div>تاريخ الانضمام</div>
                    <div>الحالة</div>
                    <div className="text-left">الإجراءات</div>
                 </div>
                 
                 {loading ? (
                    <div className="p-20 text-center flex flex-col items-center gap-3">
                       <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                       <p className="text-[10px] font-black text-slate-300 uppercase">جاري تحميل البيانات</p>
                    </div>
                 ) : filtered.length === 0 ? (
                    <div className="p-20 text-center text-slate-400 font-bold">لم يتم العثور على مدارس</div>
                 ) : filtered.map((s, idx) => (
                    <div key={s.id} className="grid grid-cols-5 items-center px-8 py-5 hover:bg-slate-50 transition-all group">
                      <div className="col-span-2 flex items-center gap-4">
                         <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-400 group-hover:border-indigo-200 group-hover:text-indigo-600 transition-all shadow-sm">
                            <Building2 className="w-5 h-5" />
                         </div>
                         <div className="min-w-0">
                            <h3 className="text-sm font-black text-slate-900 truncate">{s.name}</h3>
                            <p className="text-[10px] font-medium text-slate-400 font-mono mt-1">{s.id}</p>
                         </div>
                      </div>
                      
                      <div className="text-xs font-bold text-slate-600">
                         {new Date(s.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>

                      <div>
                         <Badge className={cn(
                           "px-3 py-1.5 rounded-lg font-black text-[10px] border-none shadow-sm",
                           s.status === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                         )}>
                            {s.status === 'active' ? 'نشط' : 'موقوف'}
                         </Badge>
                      </div>
                      
                      <div className="text-left flex items-center justify-end gap-2">
                         <Button 
                           onClick={() => toggleStatus(s.id, s.status)}
                           variant="outline" 
                           className={cn(
                             "h-9 px-4 rounded-xl text-xs font-black transition-all gap-2",
                             s.status === 'active' ? "text-rose-600 border-rose-200 hover:bg-rose-50" : "text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                           )}>
                            {s.status === 'active' ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                            {s.status === 'active' ? 'إيقاف الاشتراك' : 'تفعيل'}
                         </Button>
                      </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </div>

      {showAddModal && <AddSchoolModal onClose={() => setShowAddModal(false)} onSuccess={() => { setShowAddModal(false); window.location.reload(); }} />}
    </AppLayout>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  const configs: any = {
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
  };
  return (
    <div className="premium-card p-6 flex items-center gap-5 border border-slate-100">
       <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center border", configs[color])}>
          <Icon className="w-6 h-6" />
       </div>
       <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{title}</p>
          <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-none">{value}</h3>
       </div>
    </div>
  );
}

function AddSchoolModal({ onClose, onSuccess }: any) {
  const { toast } = useToast();
  const { logout } = useAuth();
  const [name, setName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !adminName.trim() || !phone.trim() || !password.trim()) {
      toast({ title: 'خطأ', description: 'يرجى تعبئة جميع الحقول', variant: 'destructive' });
      return;
    }
    setLoading(true);
    
    try {
      // 1. Create school
      const { data: school, error: sErr } = await (supabase as any).from('schools').insert({ name: name.trim() }).select().single();
      if (sErr || !school) throw new Error(sErr?.message || 'فشل إنشاء المدرسة');

      // 2. Register Admin User using a separate client to avoid logging out the Super Admin
      // Create a temporary client with No persistence
      const { createClient } = await import('@supabase/supabase-js');
      const tempSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        { 
          auth: { 
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
            storageKey: 'school-management-signup'
          } 
        }
      );

      const normalizedPhone = phone.replace(/\D/g, '');
      const email = `${normalizedPhone}@school.local`;
      
      const { data: authData, error: authError } = await tempSupabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: adminName.trim(), phone: normalizedPhone, role: 'admin' } }
      });

      if (authError) throw new Error(authError.message);

      if (authData.user) {
        // 3. Create User Role (CRITICAL: doing this first)
        const { error: roleError } = await (supabase as any).from('user_roles').insert({
           user_id: authData.user.id,
           role: 'admin',
           school_id: school.id
        });
        if (roleError) console.error('Role Error:', roleError);

        // 4. Create Profile
        const { error: profileError } = await (supabase as any).from('profiles').upsert({
           id: authData.user.id,
           full_name: adminName.trim(),
           phone: normalizedPhone,
           email: email,
           school_id: school.id
        });
        if (profileError) console.error('Profile Error:', profileError);
      }

      toast({ 
        title: 'تم إنشاء المدرسة وحساب المدير بنجاح', 
        description: 'يمكن للمدير الآن تسجيل الدخول ببياناته.'
      });
      onSuccess();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-right animate-in fade-in" onClick={onClose}>
      <div className="bg-white border border-slate-100 shadow-2xl w-full max-w-md p-8 rounded-[40px] animate-in zoom-in-95 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="mb-6">
           <h2 className="text-xl font-black text-slate-900 mb-2">إضافة مدرسة جديدة</h2>
           <p className="text-xs font-bold text-rose-500 bg-rose-50 p-3 rounded-xl border border-rose-100 inline-block">
             تحذير: إنشاء حساب مدير عبر هذه النافذة سيقوم بإنهاء جلستك الحالية كمطور لدواعي الأمان.
           </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase">اسم المدرسة</label>
            <Input value={name} onChange={e => setName(e.target.value)} required placeholder="مدرسة المستقبل الأهلية"
              className="h-12 px-5 rounded-xl border-slate-200 bg-slate-50 focus:bg-white font-bold" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase">اسم مدير المدرسة</label>
            <Input value={adminName} onChange={e => setAdminName(e.target.value)} required placeholder="أ. محمد أحمد"
              className="h-12 px-5 rounded-xl border-slate-200 bg-slate-50 focus:bg-white font-bold" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase">رقم هاتف المدير</label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} required placeholder="05xxxxxxxx" dir="ltr"
              className="h-12 px-5 rounded-xl border-slate-200 bg-slate-50 focus:bg-white font-bold text-left" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase">كلمة المرور الافتراضية</label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" dir="ltr"
              className="h-12 px-5 rounded-xl border-slate-200 bg-slate-50 focus:bg-white font-bold text-left" />
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading} className="flex-1 h-12 rounded-xl bg-slate-900 text-white font-black hover:bg-slate-800">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'إنشاء وحفظ'}
            </Button>
            <Button type="button" onClick={onClose} variant="outline" className="flex-1 h-12 rounded-xl font-black border-slate-200">إلغاء</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
