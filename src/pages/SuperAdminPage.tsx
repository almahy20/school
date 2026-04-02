import { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Building2, CheckCircle2, XCircle, Users, Activity, Loader2, Plus, Search, ShieldAlert, Clock, Phone, Eye, PackageCheck, PackageX } from 'lucide-react';
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
  subscription_end_date: string;
  slug: string;
  plan: string;
  students_count?: number;
}

export default function SuperAdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [schools, setSchools] = useState<School[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'schools' | 'orders'>('schools');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data: schoolsData, error } = await (supabase as any)
      .from('schools')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'خطأ في التحميل', description: error.message, variant: 'destructive' });
    } else {
      setSchools(schoolsData as School[]);
    }
    const { data: ordersData } = await (supabase as any)
      .from('school_orders')
      .select('*')
      .order('created_at', { ascending: false });
    setOrders(ordersData || []);
    setLoading(false);
  };

  useEffect(() => {
    if (user && !user.isSuperAdmin) {
      navigate('/');
      return;
    }
    fetchData();
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           <StatCard title="إجمالي المدارس المشتركة" value={stats.total} icon={Building2} color="indigo" />
           <StatCard title="المدارس النشطة" value={stats.active} icon={CheckCircle2} color="emerald" />
           <StatCard title="المدارس الموقوفة" value={stats.suspended} icon={XCircle} color="rose" />
           <StatCard title="طلبات جديدة" value={orders.filter(o => o.status === 'pending').length} icon={Clock} color="amber" />
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit gap-1">
          <button
            onClick={() => setActiveTab('schools')}
            className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'schools' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            المدارس النشطة
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${activeTab === 'orders' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            طلبات الاشتراك الجديدة
            {orders.filter(o => o.status === 'pending').length > 0 && (
              <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                {orders.filter(o => o.status === 'pending').length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'schools' && (
          <>
          <div className="flex items-center justify-between gap-4">
             <div className="relative group w-full max-w-xl text-right">
                <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
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
                   ) : filtered.map((s) => (
                      <div key={s.id} onClick={() => setSelectedSchool(s)} className="grid grid-cols-5 items-center px-8 py-5 hover:bg-slate-50 cursor-pointer transition-all group">
                        <div className="col-span-2 flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-400 group-hover:border-indigo-200 group-hover:text-indigo-600 transition-all shadow-sm shrink-0">
                              <Building2 className="w-5 h-5" />
                           </div>
                           <div className="min-w-0">
                              <h3 className="text-sm font-black text-slate-900 truncate">{s.name} <span className="text-[10px] text-slate-400 font-normal">({s.plan})</span></h3>
                              <p className="text-[10px] font-medium text-slate-400 font-mono mt-1 truncate">{s.slug}</p>
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
                        
                        <div className="text-left flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
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
          </>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="premium-card py-24 text-center">
                <PackageCheck className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 font-bold">لا توجد طلبات تسجيل حتى الآن</p>
              </div>
            ) : orders.map((order) => (
              <div key={order.id} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {order.logo_url ? (
                      <img src={order.logo_url} alt="logo" className="w-14 h-14 rounded-2xl object-cover border border-slate-100" />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                        <Building2 className="w-7 h-7 text-slate-300" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-black text-slate-900 mb-1">{order.school_name}</h3>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs font-bold text-slate-400 font-mono">{order.school_slug}</span>
                        <Badge className={cn(
                          'text-[10px] font-black px-2 py-0.5 border-none',
                          order.status === 'pending' ? 'bg-amber-50 text-amber-600' :
                          order.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                        )}>
                          {order.status === 'pending' ? 'في الانتظار' : order.status === 'approved' ? 'تم التفعيل' : 'مرفوض'}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                        <div className="text-slate-500"><span className="text-slate-400 text-xs">المدير: </span><strong>{order.admin_name}</strong></div>
                        <div className="text-slate-500" dir="ltr"><span className="text-slate-400 text-xs">WhatsApp: </span><strong>{order.admin_whatsapp}</strong></div>
                        <div className="text-slate-500"><span className="text-slate-400 text-xs">الباقة: </span><strong>{order.plan === 'monthly' ? 'شهرية' : order.plan === 'half_yearly' ? 'نصف سنوية' : 'سنوية'}</strong></div>
                        <div className="text-slate-500"><span className="text-slate-400 text-xs">تاريخ: </span>{new Date(order.created_at).toLocaleDateString('ar-EG')}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    {order.receipt_url && (
                      <a href={order.receipt_url} target="_blank" rel="noreferrer"
                        className="h-9 px-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-black hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all flex items-center gap-2">
                        <Eye className="w-3.5 h-3.5" /> عرض الإيصال
                      </a>
                    )}
                    {order.status === 'pending' && (
                      <>
                        <Button onClick={() => setSelectedOrder(order)}
                          className="h-9 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs gap-2 shadow-lg shadow-emerald-100">
                          <PackageCheck className="w-3.5 h-3.5" /> تفعيل
                        </Button>
                        <Button onClick={async () => {
                            await (supabase as any).from('school_orders').update({ status: 'rejected' }).eq('id', order.id);
                            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'rejected' } : o));
                            toast({ title: 'تم رفض الطلب' });
                          }}
                          variant="outline" className="h-9 px-4 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 font-black text-xs gap-2">
                          <PackageX className="w-3.5 h-3.5" /> رفض
                        </Button>
                      </>
                    )}
                    <a href={`https://wa.me/${order.admin_whatsapp?.replace(/[^0-9]/g,'')}`} target="_blank" rel="noreferrer"
                      className="h-9 px-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-black hover:bg-emerald-100 transition-all flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5" /> واتساب
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddModal && <AddSchoolModal onClose={() => setShowAddModal(false)} onSuccess={() => { setShowAddModal(false); fetchData(); }} />}
      {selectedSchool && <SchoolDetailsModal school={selectedSchool} onClose={() => setSelectedSchool(null)} onSuccess={() => { setSelectedSchool(null); fetchData(); }} />}
      {selectedOrder && <ActivateOrderModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onSuccess={() => { setSelectedOrder(null); fetchData(); }} />}
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

  const [slug, setSlug] = useState('');
  const [plan, setPlan] = useState('monthly');
  const [successData, setSuccessData] = useState<{ slug: string, phone: string, pass: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim() || !adminName.trim() || !phone.trim() || !password.trim()) {
      toast({ title: 'خطأ', description: 'يرجى تعبئة جميع الحقول', variant: 'destructive' });
      return;
    }
    setLoading(true);
    
    try {
      let days = 30;
      if (plan === 'yearly') days = 365;
      else if (plan === 'half_yearly') days = 180;
      const subscription_end_date = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      const { data: school, error: sErr } = await (supabase as any).from('schools').insert({ 
        name: name.trim(), 
        slug: slug.trim(),
        plan,
        subscription_end_date 
      }).select().single();
      if (sErr || !school) throw new Error(sErr?.message || 'فشل إنشاء المدرسة (تأكد من أن الـ Slug فريد)');

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
            storageKey: 'sb-temp-school-management'
          } 
        }
      );

      const normalizedPhone = phone.replace(/\D/g, '');
      const email = `${normalizedPhone}@school.local`;
      
      const { data: authData, error: authError } = await tempSupabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: adminName.trim(), phone: normalizedPhone, role: 'admin', school_id: school.id } }
      });

      if (authError) throw new Error(authError.message);

      // Note: No need to manually create user_roles or profiles here.
      // The database trigger 'on_auth_user_created' in the 'perfect_database_reset' migration
      // handles this automatically using the metadata we passed in 'signUp'.

      setSuccessData({ slug: slug.trim(), phone: normalizedPhone, pass: password });
      toast({ title: 'تم إنشاء المدرسة بنجاح' });
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

        {successData ? (
          <div className="space-y-6">
            <div className="bg-emerald-50 text-emerald-600 p-6 rounded-2xl border border-emerald-100 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3" />
              <h3 className="text-xl font-black mb-2">تم إنشاء المدرسة وتجهيز الروابط!</h3>
              <p className="text-sm font-medium">انسخ البيانات التالية وأرسلها لإدارة المدرسة.</p>
            </div>
            
            <div className="space-y-3 bg-slate-50 p-6 rounded-2xl border border-slate-100 text-sm">
               <div><span className="font-bold text-slate-400">رقم دخول المدير:</span> <span className="font-black text-slate-900" dir="ltr">{successData.phone}</span></div>
               <div><span className="font-bold text-slate-400">كلمة مرور المدير:</span> <span className="font-black text-slate-900" dir="ltr">{successData.pass}</span></div>
               <div className="pt-2 border-t border-slate-200" />
               <div>
                  <span className="font-bold text-slate-400 block mb-1">رابط التسجيل للمعلمين:</span>
                  <a href={`/register/teachers/${successData.slug}`} target="_blank" rel="noreferrer" className="text-indigo-600 font-bold hover:underline" dir="ltr">
                    {window.location.origin}/register/teachers/{successData.slug}
                  </a>
               </div>
               <div>
                  <span className="font-bold text-slate-400 block mb-1">رابط التسجيل لأولياء الأمور:</span>
                  <a href={`/register/parents/${successData.slug}`} target="_blank" rel="noreferrer" className="text-indigo-600 font-bold hover:underline" dir="ltr">
                    {window.location.origin}/register/parents/{successData.slug}
                  </a>
               </div>
            </div>

            <Button onClick={onSuccess} className="w-full h-12 rounded-xl bg-slate-900 text-white font-black hover:bg-slate-800">
              إنهاء الإضافة وإغلاق النافذة
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase">اسم المدرسة</label>
              <Input value={name} onChange={e => setName(e.target.value)} required placeholder="مدرسة المستقبل الأهلية"
                className="h-12 px-5 rounded-xl border-slate-200 bg-slate-50 focus:bg-white font-bold" />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase">رابط المدرسة (Slug - إنجليزي فقط)</label>
              <Input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} required placeholder="al-mustaqbal" minLength={3} dir="ltr"
                className="h-12 px-5 rounded-xl border-slate-200 bg-slate-50 focus:bg-white font-bold text-left" />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase">باقة الاشتراك</label>
              <select 
                value={plan} 
                onChange={e => setPlan(e.target.value)}
                className="w-full h-12 px-5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white font-bold outline-none"
              >
                <option value="monthly">باقة شهرية (30 يوم)</option>
                <option value="half_yearly">باقة نصف سنوية (180 يوم)</option>
                <option value="yearly">باقة سنوية (365 يوم)</option>
              </select>
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
        )}
      </div>
    </div>
  );
}

function SchoolDetailsModal({ school, onClose, onSuccess }: { school: School, onClose: () => void, onSuccess: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState(school.name);
  const [slug, setSlug] = useState(school.slug);
  const [plan, setPlan] = useState(school.plan || 'monthly');
  
  const originalDate = school.subscription_end_date ? new Date(school.subscription_end_date).toISOString().split('T')[0] : '';
  const [endDate, setEndDate] = useState(originalDate);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim() || !endDate) return;
    setLoading(true);
    const { error } = await supabase.from('schools').update({
      name: name.trim(),
      slug: slug.trim(),
      plan: plan,
      subscription_end_date: new Date(endDate).toISOString()
    }).eq('id', school.id);
    
    setLoading(false);
    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'تم التحديث بنجاح' });
      onSuccess();
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`هل أنت متأكد من حذف المدرسة "${school.name}" نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء وسيتم حذف جميع المستخدمين والبيانات المرتبطة بها!`)) return;
    setLoading(true);
    // Note: If you have foreign keys with cascading deletes, this will suffice.
    const { error } = await supabase.from('schools').delete().eq('id', school.id);
    setLoading(false);
    if (error) {
      toast({ title: 'فشل الحذف', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'تم الحذف الجذري للمدرسة' });
      onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-right animate-in fade-in" onClick={onClose}>
      <div className="bg-white border border-slate-100 shadow-2xl w-full max-w-lg p-8 rounded-[40px] animate-in zoom-in-95 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="mb-6 flex justify-between items-start">
           <div>
             <h2 className="text-xl font-black text-slate-900 mb-2">إدارة المدرسة والتفاصيل</h2>
             <p className="text-xs font-bold text-slate-400 font-mono">{school.id}</p>
           </div>
           <Badge className={school.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}>
             {school.status === 'active' ? 'نشط' : 'موقوف'}
           </Badge>
        </div>

        <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 mb-6 text-sm">
           <h3 className="font-bold text-slate-900 mb-3">الروابط المخصصة للمدرسة:</h3>
           <div className="space-y-2 text-[11px] font-mono leading-relaxed" dir="ltr">
             <div className="bg-white p-2 rounded-lg border border-indigo-100 overflow-x-auto whitespace-nowrap">
               <span className="text-indigo-400 font-sans ml-2">App:</span> {window.location.origin}/
             </div>
             <div className="bg-white p-2 rounded-lg border border-indigo-100 overflow-x-auto whitespace-nowrap">
               <span className="text-indigo-400 font-sans ml-2">Teachers:</span> {window.location.origin}/register/teachers/{school.slug}
             </div>
             <div className="bg-white p-2 rounded-lg border border-indigo-100 overflow-x-auto whitespace-nowrap">
               <span className="text-indigo-400 font-sans ml-2">Parents:</span> {window.location.origin}/register/parents/{school.slug}
             </div>
           </div>
        </div>

        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase">اسم المدرسة</label>
            <Input value={name} onChange={e => setName(e.target.value)} required 
              className="h-14 px-5 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white font-bold" />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase">رابط المدرسة (Slug)</label>
            <Input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} required dir="ltr"
              className="h-14 px-5 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white font-bold text-left" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase">نوع الباقة</label>
              <select value={plan} onChange={e => setPlan(e.target.value)}
                className="w-full h-14 px-5 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white font-bold outline-none appearance-none">
                <option value="monthly">شهرية</option>
                <option value="half_yearly">نصف سنوية</option>
                <option value="yearly">سنوية</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase">تاريخ الانتهاء</label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required
                className="h-14 px-5 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white font-bold" />
            </div>
          </div>

          <div className="flex gap-3 pt-6 border-t border-slate-100 mt-6">
            <Button type="submit" disabled={loading} className="flex-[2] h-14 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 shadow-xl shadow-indigo-200 text-sm">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تحديث البيانات'}
            </Button>
            <Button type="button" onClick={handleDelete} disabled={loading} variant="destructive" className="flex-1 h-14 rounded-2xl font-black text-sm">
              حذف تام
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Activate Order Modal ──────────────────────────────────────────────────────
function ActivateOrderModal({ order, onClose, onSuccess }: { order: any; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [plan, setPlan] = useState(order.plan || 'monthly');
  const [loading, setLoading] = useState(false);
  const [manualPassword, setManualPassword] = useState(order.admin_password || '');

  const PLAN_DAYS: Record<string, number> = { monthly: 30, half_yearly: 180, yearly: 365 };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalPassword = manualPassword || order.admin_password;
    if (!finalPassword || finalPassword.length < 6) {
      toast({ title: 'خطأ', description: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + (PLAN_DAYS[plan] || 30));

      // 1. Check if school already exists (due to a previous partial failure)
      let school;
      const { data: existingSchool } = await (supabase as any)
        .from('schools')
        .select('*')
        .eq('slug', order.school_slug)
        .maybeSingle();

      if (existingSchool) {
        school = existingSchool;
        // Optionally update the existing school to an active status/dates if it was suspended
        await (supabase as any).from('schools').update({
          status: 'active',
          plan: plan,
          subscription_end_date: endDate.toISOString()
        }).eq('id', school.id);
      } else {
        const { data: newSchool, error: schoolErr } = await (supabase as any)
          .from('schools')
          .insert({
            name: order.school_name,
            slug: order.school_slug,
            plan: plan,
            status: 'active',
            subscription_end_date: endDate.toISOString(),
            logo_url: order.logo_url || null,
          })
          .select()
          .single();
        if (schoolErr) throw schoolErr;
        school = newSchool;
      }

      // 2. Create admin auth account using a temporary client to avoid logging out
      const { createClient } = await import('@supabase/supabase-js');
      const tempSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        { 
          auth: { 
            persistSession: false, 
            autoRefreshToken: false, 
            detectSessionInUrl: false,
            storageKey: 'sb-temp-activate'
          } 
        }
      );

      const normalizedPhone = order.admin_phone.replace(/\D/g, '');
      const adminEmail = `${normalizedPhone}@school.local`;
      const password = manualPassword || order.admin_password;

      const { error: authErr } = await tempSupabase.auth.signUp({
        email: adminEmail,
        password: password,
        options: { 
          data: { 
            full_name: order.admin_name, 
            phone: order.admin_phone, 
            role: 'admin', 
            school_id: school.id 
          } 
        }
      });
      
      if (authErr && !authErr.message.includes('already registered')) {
        throw authErr;
      }

      // 3. Atomically activate and promote the user to admin for this school
      // This is now done via a robust RPC to ensure consistency even if user already exists
      const normalizedPhone2 = order.admin_phone.replace(/\D/g, '');
      const adminEmail2 = `${normalizedPhone2}@school.local`;
      const { data: profile } = await supabase.from('profiles').select('id').eq('email', adminEmail2).maybeSingle();
      
      if (profile) {
        const { error: rpcErr } = await (supabase as any).rpc('activate_school_admin', {
          p_user_id: profile.id,
          p_school_id: school.id,
          p_full_name: order.admin_name,
          p_phone: order.admin_phone
        });
        if (rpcErr) throw rpcErr;
      } else {
        // This case should theoretically not happen as signUp creates a profile,
        // but as a fallback, we wait a bit more for the profile to appear if it's a fresh signup
        await new Promise(r => setTimeout(r, 2000));
        const { data: p2 } = await supabase.from('profiles').select('id').eq('email', adminEmail2).maybeSingle();
        if (p2) {
          await (supabase as any).rpc('activate_school_admin', {
            p_user_id: p2.id,
            p_school_id: school.id,
            p_full_name: order.admin_name,
            p_phone: order.admin_phone
          });
        }
      }

      // 3. Mark order approved
      await (supabase as any).from('school_orders').update({ status: 'approved' }).eq('id', order.id);

      // 4. Send WhatsApp to admin with credentials
      const waMsg = encodeURIComponent(
        `🎉 *تم تفعيل حسابك — إدارة عربية*\n\n` +
        `🏫 *المدرسة:* ${order.school_name}\n` +
        `📱 *رقم الدخول:* ${order.admin_phone}\n` +
        `🔑 *كلمة المرور:* ${manualPassword || order.admin_password}\n` +
        `🌐 *رابط الدخول:* ${window.location.origin}/login\n` +
        `📅 *انتهاء الاشتراك:* ${endDate.toLocaleDateString('ar-EG')}\n\n` +
        `✅ يمكنك تسجيل الدخول الآن ومشاركة روابط التسجيل مع معلميك وأولياء الأمور.`
      );
      window.open(`https://wa.me/${order.admin_whatsapp?.replace(/[^0-9]/g, '')}?text=${waMsg}`, '_blank');

      toast({ title: '✅ تم التفعيل وإرسال بيانات الدخول على واتساب المدير' });
      onSuccess();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-right animate-in fade-in" onClick={onClose}>
      <div className="bg-white border border-slate-100 shadow-2xl w-full max-w-lg p-8 rounded-[40px] animate-in zoom-in-95 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
            <PackageCheck className="w-6 h-6 text-emerald-600" />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-1">تفعيل مدرسة: {order.school_name}</h2>
          <p className="text-sm text-slate-400 font-medium">حدد بيانات حساب المدير وسيتم إنشاؤه تلقائياً وإرسال بيانات الدخول له على واتساب.</p>
        </div>

        <form onSubmit={handleActivate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 font-bold text-xs">
            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
              <p className="text-indigo-400 mb-1">اسم المدير</p>
              <p className="text-indigo-900">{order.admin_name}</p>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
              <p className="text-amber-600 mb-1">رقم الدخول</p>
              <p className="text-amber-900">{order.admin_phone}</p>
            </div>
            <div className="p-4 rounded-2xl bg-violet-50 border border-violet-100 col-span-2">
              <p className="text-violet-600 mb-1">كلمة المرور</p>
              {order.admin_password ? (
                <p className="text-violet-900 font-mono">{order.admin_password}</p>
              ) : (
                <Input
                  value={manualPassword}
                  onChange={(e) => setManualPassword(e.target.value)}
                  placeholder="أدخل كلمة مرور (6 أحرف على الأقل)"
                  className="h-10 px-4 rounded-xl border-violet-200 bg-white font-bold text-sm"
                  dir="ltr"
                />
              )}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">الباقة</label>
            <select value={plan} onChange={e => setPlan(e.target.value)}
              className="w-full h-12 px-5 rounded-xl border border-slate-100 bg-slate-50 font-bold text-sm appearance-none">
              <option value="monthly">شهرية (30 يوم)</option>
              <option value="half_yearly">نصف سنوية (180 يوم)</option>
              <option value="yearly">سنوية (365 يوم)</option>
            </select>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-sm text-emerald-700 font-medium">
            <strong>ما سيحدث عند الضغط:</strong>
            <ul className="mt-2 space-y-1 text-emerald-600 text-xs">
              <li>✅ إنشاء المدرسة في قاعدة البيانات</li>
              <li>✅ إنشاء حساب المدير برقم الهاتف وكلمة المرور المختارة</li>
              <li>✅ إرسال بيانات الدخول للمدير على واتساب</li>
            </ul>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading}
              className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-lg shadow-emerald-100 text-sm">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '✅ تفعيل وإرسال بيانات الدخول'}
            </Button>
            <Button type="button" onClick={onClose} variant="ghost"
              className="h-12 px-6 rounded-xl bg-slate-50 font-black text-sm">إلغاء</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
