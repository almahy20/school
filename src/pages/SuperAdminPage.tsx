import { useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { 
  ShieldAlert, Plus, Search, Building2, CheckCircle2, 
  XCircle, Users, Activity, Clock, Eye, 
  PackageCheck, PackageX, Target, Wallet, Database, HardDrive, Table
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  useSchools, 
  useSchoolOrders, 
  useUpdateSchool, 
  useUpdateOrder,
  useDatabaseStats
} from '@/hooks/queries';
import { QueryStateHandler } from '@/components/QueryStateHandler';

export default function SuperAdminPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'schools' | 'orders' | 'database'>('schools');
  const [search, setSearch] = useState('');

  // â”€â”€ Queries â”€â”€
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

  const {
    data: dbStats,
    isLoading: dbStatsLoading,
    refetch: refetchDbStats
  } = useDatabaseStats();

  // â”€â”€ Mutations â”€â”€
  const updateSchoolMutation = useUpdateSchool();
  const updateOrderMutation = useUpdateOrder();

  const toggleStatus = async (schoolId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      await updateSchoolMutation.mutateAsync({ id: schoolId, status: newStatus as any });
      toast({ title: 'ØªÙ… ØªØ­Ø¯ÙŠØ« Ø­Ø§Ù„Ø© Ø§Ù„Ù…Ø¯Ø±Ø³Ø© Ø¨Ù†Ø¬Ø§Ø­' });
    } catch (err: any) {
      toast({ title: 'Ø®Ø·Ø£', description: err.message, variant: 'destructive' });
    }
  };

  const handleOrderAction = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await updateOrderMutation.mutateAsync({ id, status });
      toast({ title: status === 'approved' ? 'ØªÙ…Øª Ø§Ù„Ù…ÙˆØ§ÙÙ‚Ø© Ø¹Ù„Ù‰ Ø§Ù„Ø·Ù„Ø¨' : 'ØªÙ… Ø±ÙØ¶ Ø§Ù„Ø·Ù„Ø¨' });
    } catch (err: any) {
      toast({ title: 'Ø®Ø·Ø£', description: err.message, variant: 'destructive' });
    }
  };

  const filteredSchools = useMemo(() => {
    return (schools || []).filter(s => (s.name || '').toLowerCase().includes((search || '').toLowerCase()));
  }, [schools, search]);

  const filteredOrders = useMemo(() => {
    return (orders || []).filter(o => (o.school_name || '').toLowerCase().includes((search || '').toLowerCase()));
  }, [orders, search]);

  const stats = useMemo(() => ({
    total: schools.length,
    active: schools.filter(s => s.status === 'active').length,
    suspended: schools.filter(s => s.status === 'suspended').length,
    pendingOrders: orders.filter(o => o.status === 'pending').length
  }), [schools, orders]);

  return (
    <AppLayout>
      <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1400px] mx-auto text-right pb-16">
        <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 bg-slate-900 text-white p-8 md:p-10 lg:p-12 rounded-[32px] md:rounded-[48px] shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          <div className="space-y-3 relative z-10">
            <div className="flex items-center gap-4">
               <div className="w-14 h-14 rounded-[20px] bg-rose-500 flex items-center justify-center text-white shadow-xl rotate-3 group-hover:rotate-0 transition-all duration-500">
                  <ShieldAlert className="w-7 h-7" />
               </div>
               <h1 className="text-2xl md:text-4xl font-black tracking-tight leading-none">Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…Ù†ØµØ© Ø§Ù„Ù…Ø±ÙƒØ²ÙŠØ©</h1>
            </div>
            <p className="text-slate-400 font-medium text-base pr-1 max-w-2xl">Ø§Ù„ØªØ­ÙƒÙ… Ø§Ù„Ø´Ø§Ù…Ù„ ÙÙŠ Ø§Ø³ØªÙ…Ø±Ø§Ø±ÙŠØ© Ø§Ù„Ø®Ø¯Ù…Ø§Øª Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ© ÙˆØ¥Ø¯Ø§Ø±Ø© Ø¯ÙˆØ±Ø© Ø­ÙŠØ§Ø© Ø§Ø´ØªØ±Ø§ÙƒØ§Øª Ø§Ù„Ù…Ø¯Ø§Ø±Ø³.</p>
          </div>
          
          <div className="flex items-center gap-6 relative z-10">
             <div className="hidden sm:flex items-center p-2 bg-white/5 rounded-2xl">
                <button 
                  onClick={() => setActiveTab('schools')}
                  className={cn("px-8 py-3 rounded-xl text-xs font-black transition-all", activeTab === 'schools' ? "bg-white text-slate-900 shadow-xl" : "text-slate-400 hover:text-white")}
                >Ø§Ù„Ù…Ø¯Ø§Ø±Ø³ Ø§Ù„Ù…Ø´ØªØ±ÙƒØ©</button>
                <button 
                  onClick={() => setActiveTab('orders')}
                  className={cn("px-8 py-3 rounded-xl text-xs font-black transition-all", activeTab === 'orders' ? "bg-white text-slate-900 shadow-xl" : "text-slate-400 hover:text-white")}
                >Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ø§Ù†Ø¶Ù…Ø§Ù… {stats.pendingOrders > 0 && <Badge className="mr-2 h-5 min-w-5 px-1 bg-rose-500 text-white border-none text-[8px] animate-pulse">{stats.pendingOrders}</Badge>} </button>
                <button 
                  onClick={() => setActiveTab('database')}
                  className={cn("px-8 py-3 rounded-xl text-xs font-black transition-all", activeTab === 'database' ? "bg-white text-slate-900 shadow-xl" : "text-slate-400 hover:text-white")}
                >Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª</button>
             </div>
             <Button className="h-14 px-8 rounded-2xl bg-indigo-600 text-white font-black text-xs hover:bg-indigo-700 transition-all gap-4 shadow-2xl shadow-indigo-500/20">
               <Plus className="w-4 h-4" /> Ø¥Ø¶Ø§ÙØ© Ù…Ø¯Ø±Ø³Ø©
             </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
           <SuperAdminStatsCard title="Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ù…Ø¯Ø§Ø±Ø³" value={stats.total} icon={Building2} color="indigo" />
           <SuperAdminStatsCard title="Ø§Ù„Ù…Ø¯Ø§Ø±Ø³ Ø§Ù„Ù†Ø´Ø·Ø©" value={stats.active} icon={CheckCircle2} color="emerald" />
           <SuperAdminStatsCard title="Ù…Ø¯Ø§Ø±Ø³ Ù…Ø¹Ù„Ù‚Ø©" value={stats.suspended} icon={XCircle} color="rose" />
           <SuperAdminStatsCard title="Ø·Ù„Ø¨Ø§Øª Ù…Ø¹Ù„Ù‚Ø©" value={stats.pendingOrders} icon={Clock} color="amber" />
        </div>

        {/* Database Management Tab */}
        {activeTab === 'database' && (
          <div className="space-y-8">
            {/* Database Overview */}
            <div className="premium-card p-10 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center">
                    <Database className="w-8 h-8 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black">Ø¥Ø¯Ø§Ø±Ø© Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª</h2>
                    <p className="text-slate-400 text-sm mt-1">Ù…Ø±Ø§Ù‚Ø¨Ø© Ø§Ø³ØªØ®Ø¯Ø§Ù… Ø§Ù„Ù…Ø³Ø§Ø­Ø© ÙˆØ§Ù„Ø£Ø¯Ø§Ø¡</p>
                  </div>
                </div>
                <Button
                  onClick={refetchDbStats}
                  disabled={dbStatsLoading}
                  className="h-12 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-black text-xs"
                >
                  {dbStatsLoading ? 'Ø¬Ø§Ø±ÙŠ Ø§Ù„ØªØ­Ø¯ÙŠØ«...' : 'ØªØ­Ø¯ÙŠØ« Ø§Ù„Ø¥Ø­ØµØ§Ø¦ÙŠØ§Øª'}
                </Button>
              </div>

              {/* Summary Stats */}
              {dbStats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl">
                    <div className="flex items-center gap-3 mb-2">
                      <Table className="w-5 h-5 text-indigo-400" />
                      <p className="text-xs font-bold text-slate-400">Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ø¬Ø¯Ø§ÙˆÙ„</p>
                    </div>
                    <p className="text-3xl font-black">{dbStats.totalTables}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl">
                    <div className="flex items-center gap-3 mb-2">
                      <Users className="w-5 h-5 text-emerald-400" />
                      <p className="text-xs font-bold text-slate-400">Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ø³Ø¬Ù„Ø§Øª</p>
                    </div>
                    <p className="text-3xl font-black">{dbStats.totalRows.toLocaleString('ar-EG')}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl">
                    <div className="flex items-center gap-3 mb-2">
                      <HardDrive className="w-5 h-5 text-amber-400" />
                      <p className="text-xs font-bold text-slate-400">Ø¢Ø®Ø± ØªØ­Ø¯ÙŠØ«</p>
                    </div>
                    <p className="text-sm font-bold">{new Date(dbStats.lastUpdated).toLocaleTimeString('ar-EG')}</p>
                  </div>
                </div>
              )}

              {/* Tables Grid */}
              {dbStatsLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                </div>
              ) : dbStats ? (
                <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8">
                  <h3 className="text-lg font-black mb-6">ØªÙØ§ØµÙŠÙ„ Ø§Ù„Ø¬Ø¯Ø§ÙˆÙ„</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(dbStats.tables).map(([tableName, stats]: [string, any]) => (
                      <div key={tableName} className="bg-white/10 p-5 rounded-xl hover:bg-white/15 transition-all">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-black text-sm capitalize">{tableName}</h4>
                          <Badge className="bg-indigo-500/20 text-indigo-300 border-none text-[10px]">
                            {stats.count.toLocaleString('ar-EG')} Ø³Ø¬Ù„
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <HardDrive className="w-4 h-4" />
                          <span>Ø§Ù„Ù…Ø³Ø§Ø­Ø© Ø§Ù„ØªÙ‚Ø¯ÙŠØ±ÙŠØ©: <span className="text-white font-bold">{stats.size_estimate}</span></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        <div className="relative group w-full lg:max-w-2xl self-start">
           <Search className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
           <Input 
             placeholder={activeTab === 'schools' ? "Ø§Ù„Ø¨Ø­Ø« Ø¨Ø§Ø³Ù… Ø§Ù„Ù…Ø¯Ø±Ø³Ø© Ø£Ùˆ Ø§Ù„Ù…Ø¹Ø±Ù..." : "Ø§Ù„Ø¨Ø­Ø« ÙÙŠ Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ø§Ù†Ø¶Ù…Ø§Ù…..."} 
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
          loadingMessage="Ø¬Ø§Ø±ÙŠ Ø¬Ù„Ø¨ Ø£Ø­Ø¯Ø« Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª..."
          emptyMessage="Ù„Ù… ÙŠØªÙ… Ø§Ù„Ø¹Ø«ÙˆØ± Ø¹Ù„Ù‰ Ù†ØªØ§Ø¦Ø¬ ØªØ·Ø§Ø¨Ù‚ Ù…Ø¹Ø§ÙŠÙŠØ± Ø§Ù„Ø¨Ø­Ø«."
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
             )}>{school.status === 'active' ? 'Ù†Ø´Ø·' : 'Ù…Ø¹Ù„Ù‚'}</Badge>
          </div>
          
          <div>
             <h3 className="text-2xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors mb-2">{school.name}</h3>
             <code className="text-[10px] font-black text-slate-300 uppercase tracking-tighter" dir="ltr">ID: {school.id}</code>
          </div>

          <div className="flex flex-col gap-4">
             <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>ØªØ§Ø±ÙŠØ® Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ:</span>
                <span className="text-slate-900">{new Date(school.created_at).toLocaleDateString('ar-EG')}</span>
             </div>
             <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>Ù†Ù‡Ø§ÙŠØ© Ø§Ù„ØµÙ„Ø§Ø­ÙŠØ©:</span>
                <span className="text-rose-500">{new Date(school.subscription_end_date).toLocaleDateString('ar-EG')}</span>
             </div>
          </div>

          <div className="flex gap-4 pt-4">
             <Button 
               variant="outline" 
               className="flex-1 h-12 rounded-2xl border-slate-100 font-black text-xs hover:bg-slate-50 transition-all"
             >
                ØªØ­Ø±ÙŠØ± Ø§Ù„Ù…ÙˆØ§Ø±Ø¯
             </Button>
             <Button 
               onClick={() => onToggle(school.id, school.status)}
               disabled={isPending}
               className={cn(
                 "flex-1 h-12 rounded-2xl font-black text-xs text-white shadow-xl transition-all",
                 school.status === 'active' ? "bg-rose-500 hover:bg-rose-600 shadow-rose-200" : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200"
               )}
             >
                {isPending ? 'Ø¬Ø§Ø±ÙŠ...' : (school.status === 'active' ? 'ØªØ¹Ù„ÙŠÙ‚ Ø§Ù„Ø®Ø¯Ù…Ø§Øª' : 'ØªÙØ¹ÙŠÙ„ Ø§Ù„Ø®Ø¯Ù…Ø§Øª')}
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
                <Badge variant="outline" className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-none">{order.plan || order.school_slug || "—"}</Badge>
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
                  <PackageX className="w-4 h-4" /> Ø±ÙØ¶
               </Button>
               <Button onClick={() => onAction(order.id, 'approved')} disabled={isPending}
                 className="flex-1 md:flex-none h-12 px-8 rounded-2xl bg-emerald-500 text-white font-black text-xs shadow-xl shadow-emerald-200 hover:scale-[1.02] transition-all gap-3">
                  <PackageCheck className="w-4 h-4" /> ØªÙØ¹ÙŠÙ„ ÙˆÙ‚Ø¨ÙˆÙ„
               </Button>
            </>
          ) : (
            <Badge className={cn(
              "h-12 px-8 rounded-2xl font-black text-xs border-none",
              order.status === 'approved' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
            )}>{order.status === 'approved' ? 'Ù…Ù‚Ø¨ÙˆÙ„' : 'Ù…Ø±ÙÙˆØ¶'}</Badge>
          )}
       </div>
    </div>
  );
}

