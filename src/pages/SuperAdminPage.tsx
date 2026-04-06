import { useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  ShieldAlert, Plus, Search, Building2, CheckCircle2, 
  XCircle, Users, Activity, Clock, Eye, 
  PackageCheck, PackageX, Target, Wallet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  useSchools, 
  useSchoolOrders, 
  useUpdateSchool, 
  useUpdateOrder 
} from '@/hooks/queries';
import { QueryStateHandler } from '@/components/QueryStateHandler';

export default function SuperAdminPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'schools' | 'orders'>('schools');
  const [search, setSearch] = useState('');

  // ── Queries ──
  const { 
    data: schools = [], 
    isLoading: schoolsLoading, 
    error: schoolsError, 
    refetch: refetchSchools 
  } = useSchools();
  
  const { 
    data: orders = [], 
    isLoading: ordersLoading, 
    error: ordersError, 
    refetch: refetchOrders 
  } = useSchoolOrders();

  // ── Mutations ──
  const updateSchoolMutation = useUpdateSchool();
  const updateOrderMutation = useUpdateOrder();

  const toggleStatus = async (schoolId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      await updateSchoolMutation.mutateAsync({ id: schoolId, status: newStatus as any });
      toast({ title: 'تم تحديث حالة المدرسة بنجاح' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleOrderAction = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await updateOrderMutation.mutateAsync({ id, status });
      toast({ title: status === 'approved' ? 'تمت الموافقة على الطلب' : 'تم رفض الطلب' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const filteredSchools = useMemo(() => {
    return schools.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  }, [schools, search]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => o.school_name.toLowerCase().includes(search.toLowerCase()));
  }, [orders, search]);

  const stats = useMemo(() => ({
    total: schools.length,
    active: schools.filter(s => s.status === 'active').length,
    suspended: schools.filter(s => s.status === 'suspended').length,
    pendingOrders: orders.filter(o => o.status === 'pending').length
  }), [schools, orders]);

  return (
    <AppLayout>
      <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1400px] mx-auto text-right pb-20">
        <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 bg-slate-900 text-white p-12 sm:p-14 rounded-[56px] shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          <div className="space-y-4 relative z-10">
            <div className="flex items-center gap-4">
               <div className="w-16 h-16 rounded-[24px] bg-rose-500 flex items-center justify-center text-white shadow-xl rotate-3 group-hover:rotate-0 transition-all duration-500">
                  <ShieldAlert className="w-8 h-8" />
               </div>
               <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-none">إدارة المنصة المركزية</h1>
            </div>
            <p className="text-slate-400 font-medium text-lg pr-2 max-w-2xl">التحكم الشامل في استمرارية الخدمات التعليمية وإدارة دورة حياة اشتراكات المدارس.</p>
          </div>
          
          <div className="flex items-center gap-6 relative z-10">
             <div className="hidden sm:flex items-center p-2 bg-white/5 rounded-2xl">
                <button 
                  onClick={() => setActiveTab('schools')}
                  className={cn("px-8 py-3 rounded-xl text-xs font-black transition-all", activeTab === 'schools' ? "bg-white text-slate-900 shadow-xl" : "text-slate-400 hover:text-white")}
                >المدارس المشتركة</button>
                <button 
                  onClick={() => setActiveTab('orders')}
                  className={cn("px-8 py-3 rounded-xl text-xs font-black transition-all", activeTab === 'orders' ? "bg-white text-slate-900 shadow-xl" : "text-slate-400 hover:text-white")}
                >طلبات الانضمام {stats.pendingOrders > 0 && <Badge className="mr-2 h-5 min-w-5 px-1 bg-rose-500 text-white border-none text-[8px] animate-pulse">{stats.pendingOrders}</Badge>} </button>
             </div>
             <Button className="h-14 px-8 rounded-2xl bg-indigo-600 text-white font-black text-xs hover:bg-indigo-700 transition-all gap-4 shadow-2xl shadow-indigo-500/20">
               <Plus className="w-4 h-4" /> إضافة مدرسة
             </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
           <SuperAdminStatsCard title="إجمالي المدارس" value={stats.total} icon={Building2} color="indigo" />
           <SuperAdminStatsCard title="المدارس النشطة" value={stats.active} icon={CheckCircle2} color="emerald" />
           <SuperAdminStatsCard title="مدارس معلقة" value={stats.suspended} icon={XCircle} color="rose" />
           <SuperAdminStatsCard title="طلبات معلقة" value={stats.pendingOrders} icon={Clock} color="amber" />
        </div>

        <div className="relative group w-full lg:max-w-2xl self-start">
           <Search className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
           <Input 
             placeholder={activeTab === 'schools' ? "البحث باسم المدرسة أو المعرف..." : "البحث في طلبات الانضمام..."} 
             value={search}
             onChange={e => setSearch(e.target.value)}
             className="h-14 pr-14 pl-6 rounded-[28px] border-none bg-white text-base font-bold shadow-xl shadow-slate-200/20 focus:ring-4 focus:ring-indigo-600/5 transition-all" 
           />
        </div>

        <QueryStateHandler
          loading={activeTab === 'schools' ? schoolsLoading : ordersLoading}
          error={activeTab === 'schools' ? schoolsError : ordersError}
          data={activeTab === 'schools' ? schools : orders}
          onRetry={activeTab === 'schools' ? refetchSchools : refetchOrders}
          isEmpty={(activeTab === 'schools' ? filteredSchools.length : filteredOrders.length) === 0}
          loadingMessage="جاري جلب أحدث البيانات..."
          emptyMessage="لم يتم العثور على نتائج تطابق معايير البحث."
        >
          {activeTab === 'schools' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
               {filteredSchools.map(school => (
                 <SchoolCard key={school.id} school={school} onToggle={toggleStatus} isPending={updateSchoolMutation.isPending} />
               ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               {filteredOrders.map(order => (
                 <OrderCard key={order.id} order={order} onAction={handleOrderAction} isPending={updateOrderMutation.isPending} />
               ))}
            </div>
          )}
        </QueryStateHandler>
      </div>
    </AppLayout>
  );
}

function SuperAdminStatsCard({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    indigo: "bg-indigo-600 text-white",
    emerald: "bg-emerald-500 text-white",
    rose: "bg-rose-500 text-white",
    amber: "bg-amber-500 text-white"
  };
  return (
    <div className={cn("premium-card p-8 flex items-center gap-6 border-none", colors[color])}>
       <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-white shrink-0">
          <Icon className="w-7 h-7" />
       </div>
       <div>
          <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{title}</p>
          <h3 className="text-3xl font-black leading-none">{value}</h3>
       </div>
    </div>
  );
}

function SchoolCard({ school, onToggle, isPending }: { school: any; onToggle: (id: string, s: string) => void, isPending: boolean }) {
  return (
    <div className="group premium-card p-0 overflow-hidden hover:scale-[1.02] transition-all duration-500 shadow-xl shadow-slate-200/20">
       <div className={cn("h-2 w-full transition-all duration-500", school.status === 'active' ? "bg-emerald-500" : "bg-rose-500")} />
       <div className="p-10 space-y-8">
          <div className="flex items-center justify-between">
             <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-200 border border-slate-100 group-hover:scale-110 transition-transform">
                <Building2 className="w-7 h-7" />
             </div>
             <Badge className={cn(
                "rounded-lg px-3 py-1 font-black text-[9px] uppercase tracking-widest border-none",
                school.status === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
             )}>{school.status === 'active' ? 'نشط' : 'معلق'}</Badge>
          </div>
          
          <div>
             <h3 className="text-2xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors mb-2">{school.name}</h3>
             <code className="text-[10px] font-black text-slate-300 uppercase tracking-tighter" dir="ltr">ID: {school.id}</code>
          </div>

          <div className="flex flex-col gap-4">
             <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>تاريخ الاشتراك:</span>
                <span className="text-slate-900">{new Date(school.created_at).toLocaleDateString('ar-EG')}</span>
             </div>
             <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>نهاية الصلاحية:</span>
                <span className="text-rose-500">{new Date(school.subscription_end_date).toLocaleDateString('ar-EG')}</span>
             </div>
          </div>

          <div className="flex gap-4 pt-4">
             <Button 
               variant="outline" 
               className="flex-1 h-12 rounded-2xl border-slate-100 font-black text-xs hover:bg-slate-50 transition-all"
             >
                تحرير الموارد
             </Button>
             <Button 
               onClick={() => onToggle(school.id, school.status)}
               disabled={isPending}
               className={cn(
                 "flex-1 h-12 rounded-2xl font-black text-xs text-white shadow-xl transition-all",
                 school.status === 'active' ? "bg-rose-500 hover:bg-rose-600 shadow-rose-200" : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200"
               )}
             >
                {isPending ? 'جاري...' : (school.status === 'active' ? 'تعليق الخدمات' : 'تفعيل الخدمات')}
             </Button>
          </div>
       </div>
    </div>
  );
}

function OrderCard({ order, onAction, isPending }: { order: any; onAction: (id: string, s: any) => void, isPending: boolean }) {
  return (
    <div className="premium-card p-10 flex flex-col md:flex-row gap-10 items-start md:items-center justify-between bg-white relative overflow-hidden group">
       <div className="absolute top-0 right-0 w-2 h-full bg-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
       
       <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-[24px] bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
             <Target className="w-8 h-8" />
          </div>
          <div className="space-y-1">
             <h3 className="text-2xl font-black text-slate-900 leading-tight">{order.school_name}</h3>
             <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline" className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-none">{order.package_type}</Badge>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                   <Clock className="w-3.5 h-3.5" />
                   {new Date(order.created_at).toLocaleDateString('ar-EG')}
                </div>
             </div>
          </div>
       </div>

       <div className="flex flex-col gap-2 min-w-[200px]">
          <div className="flex items-center gap-3 text-xs font-black text-slate-500 px-4 py-2 bg-slate-50 rounded-xl">
             <Wallet className="w-4 h-4 text-emerald-500" />
             {order.admin_name}
          </div>
       </div>

       <div className="flex gap-4 w-full md:w-auto">
          {order.status === 'pending' ? (
            <>
               <Button onClick={() => onAction(order.id, 'rejected')} disabled={isPending}
                 className="flex-1 md:flex-none h-12 px-8 rounded-2xl bg-white text-rose-500 border-2 border-rose-100 hover:bg-rose-50 transition-all font-black text-xs gap-3">
                  <PackageX className="w-4 h-4" /> رفض
               </Button>
               <Button onClick={() => onAction(order.id, 'approved')} disabled={isPending}
                 className="flex-1 md:flex-none h-12 px-8 rounded-2xl bg-emerald-500 text-white font-black text-xs shadow-xl shadow-emerald-200 hover:scale-[1.02] transition-all gap-3">
                  <PackageCheck className="w-4 h-4" /> تفعيل وقبول
               </Button>
            </>
          ) : (
            <Badge className={cn(
              "h-12 px-8 rounded-2xl font-black text-xs border-none",
              order.status === 'approved' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
            )}>{order.status === 'approved' ? 'مقبول' : 'مرفوض'}</Badge>
          )}
       </div>
    </div>
  );
}
