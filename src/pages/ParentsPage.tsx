import { useState, useMemo, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useParents, useParentAction, useBranding, type Parent } from '@/hooks/queries';
import DataPagination from '@/components/ui/DataPagination';
import { Phone, User, Eye, X, Search, Users, ArrowLeft, ShieldCheck, XCircle, Clock, Link as LinkIcon, Copy, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import PageHeader from '@/components/layout/PageHeader';

const PAGE_SIZE = 15;

// No need for separate fetch function here, moved to useParents hook

export default function ParentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  // ── Debounce Search ──
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  // ── React Query Hooks ──
  // جلب أولياء الأمور المعتمدين مع التجزئة والبحث
  const { 
    data: parentsData, 
    isLoading: loading, 
    error, 
    refetch, 
    isRefetching 
  } = useParents(page, PAGE_SIZE, debouncedSearch, 'معتمد');

  // جلب طلبات الانتظار (قائمة منفصلة عادة ما تكون صغيرة)
  const { 
    data: pendingData, 
    refetch: refetchPending 
  } = useParents(1, 100, '', 'معلق');

  const { data: branding } = useBranding();
  const actionMutation = useParentAction();
  
  const parents = parentsData?.data || [];
  const pendingParents = pendingData?.data || [];
  const totalItems = parentsData?.count || 0;

  const handleAction = async (userRoleId: string, status: 'approved' | 'rejected') => {
    try {
      await actionMutation.mutateAsync({ userRoleId, status });
      toast({ title: 'تم الحفظ', description: status === 'approved' ? 'تمت الموافقة على ولي الأمر' : 'تم رفض الطلب' });
      refetch();
      refetchPending();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const copyLink = () => {
    if (!branding?.slug) {
      toast({ title: 'تنبيه', description: 'جاري تحميل بيانات المدرسة...', variant: 'default' });
      return;
    }
    const link = `${window.location.origin}/register/parents/${branding.slug}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'تم النسخ', description: 'تم نسخ رابط التسجيل للحافظة' });
  };

  const handleSearch = (val: string) => { setSearch(val); setPage(1); };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 md:gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1400px] mx-auto text-right pb-20 px-2 md:px-0">
        <PageHeader
          icon={UserCheck}
          title="أولياء الأمور"
          subtitle="بيانات التواصل، الروابط الأسرية، وطلبات الانضمام"
          action={
            <button
              onClick={copyLink}
              className="h-12 px-8 rounded-2xl bg-slate-900 text-white font-black text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-slate-200 gap-3 flex items-center"
            >
              <Copy className="w-4 h-4 ml-2" /> نسخ رابط التسجيل
            </button>
          }
        />

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="premium-card border-slate-100 p-8 flex items-center gap-5 relative overflow-hidden group">
             <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-emerald-600 shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-all">
               <Users className="w-7 h-7" />
             </div>
             <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">إجمالي المعتمدين</p>
               <p className="text-4xl font-black text-slate-900 leading-none mt-1">{totalItems}</p>
             </div>
           </div>

           <div className="premium-card border-amber-100 bg-gradient-to-br from-amber-500 to-orange-500 text-white p-8 flex items-center gap-5 relative overflow-hidden group shadow-xl shadow-amber-200/50">
             <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
               <Clock className="w-7 h-7" />
             </div>
             <div>
               <p className="text-[10px] font-black text-white/70 uppercase tracking-widest">طلبات الانتظار</p>
               <p className="text-4xl font-black leading-none mt-1">{pendingParents.length}</p>
             </div>
           </div>

           <div className="premium-card border-indigo-100 bg-indigo-50/50 p-8 flex items-center gap-5 relative overflow-hidden group">
             <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
               <LinkIcon className="w-7 h-7" />
             </div>
             <div className="flex-1 min-w-0">
               <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">رابط التسجيل</p>
               <p className="text-sm font-black text-slate-700 mt-1 truncate">مخصص لمدرستك</p>
             </div>
           </div>
        </div>

        {/* Pending Approvals */}
        {pendingParents.length > 0 && (
          <div className="premium-card border-amber-100 bg-amber-50/10 p-6 overflow-hidden relative">
            <h2 className="text-lg font-black text-amber-900 flex items-center gap-2 mb-6"><Clock className="w-5 h-5 text-amber-600" /> طلبات انضمام في انتظار المراجعة</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {pendingParents.map(u => (
                 <div key={u.id} className="bg-white rounded-2xl border border-amber-100 p-5 shadow-sm hover:shadow-md transition-all">
                    <h3 className="font-bold text-slate-900 text-sm mb-1">{u.full_name}</h3>
                    <p className="text-xs text-slate-500 mb-4" dir="ltr">{u.phone}</p>
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => handleAction(u.user_role_id!, 'approved')} 
                        disabled={actionMutation.isPending && actionMutation.variables?.userRoleId === u.user_role_id} 
                        className="flex-1 h-9 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white font-bold text-xs gap-1.5 p-0"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" /> قبول
                      </Button>
                      <Button 
                        onClick={() => handleAction(u.user_role_id!, 'rejected')} 
                        disabled={actionMutation.isPending && actionMutation.variables?.userRoleId === u.user_role_id} 
                        className="flex-1 h-9 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white font-bold text-xs gap-1.5 p-0"
                      >
                        <XCircle className="w-3.5 h-3.5" /> رفض
                      </Button>
                    </div>
                 </div>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative group max-w-2xl w-full">
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
          <Input
            type="text"
            placeholder="ابحث باسم ولي الأمر أو رقم الهاتف..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="h-14 pr-14 pl-6 rounded-[28px] border-none bg-white font-bold shadow-xl shadow-slate-200/20 focus:ring-4 focus:ring-indigo-600/5"
          />
        </div>

        <QueryStateHandler
          loading={loading}
          error={error}
          data={parentsData?.data || []}
          onRetry={refetch}
          isRefetching={isRefetching}
          loadingMessage="جاري مزامنة بيانات أولياء الأمور..."
          errorMessage="فشل تحميل قائمة أولياء الأمور."
          isEmpty={parents.length === 0}
        >
          <div className="space-y-10">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                {totalItems} ولي أمر — الصفحة {page}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {parents.map(p => (
                <ParentCard key={p.id} parent={p as any} onClick={() => navigate(`/parents/${p.id}`)} />
              ))}
            </div>
            <DataPagination
              currentPage={page}
              totalItems={totalItems}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        </QueryStateHandler>
      </div>
    </AppLayout>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function ParentCard({ parent, onClick }: { parent: Parent; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col text-right group h-full transition-all">
      <div className="premium-card p-6 flex flex-col flex-1 hover:translate-y-[-4px] transition-all duration-500 w-full relative overflow-hidden space-y-5">
        <div className="flex items-center justify-between">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-slate-900 group-hover:text-white transition-all duration-500">
            <User className="w-6 h-6" />
          </div>
          <Badge className="bg-emerald-50 text-emerald-600 font-black text-[8px] border-none px-3">معتمد</Badge>
        </div>

        <div>
          <h3 className="text-lg font-black text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors leading-tight">{parent.full_name || '...'}</h3>
          {(parent as any).phone && (
            <p className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5" dir="ltr">
              <Phone className="w-3 h-3" />{(parent as any).phone}
            </p>
          )}
        </div>

        <div className="pt-4 border-t border-slate-50 w-full flex justify-between items-center">
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">ولي أمر</span>
          <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">
            استعراض ←
          </span>
        </div>
      </div>
    </button>
  );
}
