import { useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useParents, useParentAction, useBranding } from '@/hooks/queries';
import DataPagination from '@/components/ui/DataPagination';
import { Phone, User, Eye, X, Search, Users, ArrowLeft, ShieldCheck, XCircle, Clock, Link as LinkIcon, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QueryStateHandler } from '@/components/QueryStateHandler';

const PAGE_SIZE = 15;

// No need for separate fetch function here, moved to useParents hook

export default function ParentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: allParents = [], isLoading: loading, error, refetch, isRefetching } = useParents();
  const { data: branding } = useBranding();
  const actionMutation = useParentAction();
  
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { parents, pendingParents } = useMemo(() => ({
    parents: allParents.filter(p => p.approval_status === 'approved'),
    pendingParents: allParents.filter(p => p.approval_status === 'pending')
  }), [allParents]);

  const handleAction = async (userRoleId: string, status: 'approved' | 'rejected') => {
    try {
      await actionMutation.mutateAsync({ userRoleId, status });
      toast({ title: 'تم الحفظ', description: status === 'approved' ? 'تمت الموافقة على ولي الأمر' : 'تم رفض الطلب' });
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

  const filtered = useMemo(() => parents.filter(p =>
    (p.full_name || '').includes(search) || (p.phone || '').includes(search)
  ), [parents, search]);

  const totalItems = filtered.length;
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const handleSearch = (val: string) => { setSearch(val); setPage(1); };

  return (
    <AppLayout>
      <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1400px] mx-auto text-right">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">سجل أولياء الأمور</h1>
            <p className="text-sm text-slate-400 font-medium tracking-wide">بيانات التواصل والروابط الأسرية</p>
          </div>
        </header>

        {/* Registration Link & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           <div className="md:col-span-1 premium-card p-5 border border-indigo-100 bg-indigo-50/50 flex flex-col justify-center items-start gap-3">
             <div className="flex items-center gap-2">
               <LinkIcon className="w-5 h-5 text-indigo-600" />
               <h3 className="font-black text-indigo-900 text-sm">رابط توجيه الآباء</h3>
             </div>
             <p className="text-[10px] text-indigo-600/70 font-medium leading-relaxed">انسخ هذا الرابط وأرسله لأولياء الأمور لإنشاء حسابات المتابعة.</p>
             <Button onClick={copyLink} className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 text-xs gap-2 rounded-xl shadow-lg shadow-indigo-200">
               <Copy className="w-4 h-4" /> نسخ الرابط
             </Button>
           </div>
           
           <div className="md:col-span-3 flex gap-6">
             <div className="flex-1 premium-card border-slate-100 p-6 flex flex-col justify-center gap-2 relative overflow-hidden group">
                <div className="absolute left-6 top-1/2 -translate-y-1/2 w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users className="w-8 h-8" />
                </div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest relative z-10">إجمالي المعتمدين</p>
                <div className="text-4xl font-black text-slate-900 leading-none relative z-10">{parents.length}</div>
             </div>
             <div className="flex-1 premium-card border-amber-100 bg-amber-500 text-white p-6 flex flex-col justify-center gap-2 relative overflow-hidden group shadow-xl shadow-amber-200/50">
                <div className="absolute left-6 top-1/2 -translate-y-1/2 w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Clock className="w-8 h-8" />
                </div>
                <p className="text-xs font-black text-white/80 uppercase tracking-widest relative z-10">طلبات الانتظار</p>
                <div className="text-4xl font-black leading-none relative z-10">{pendingParents.length}</div>
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
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-primary transition-colors" />
          <input type="text" placeholder="ابحث باسم ولي الأمر أو رقم الهاتف..." value={search}
            onChange={e => handleSearch(e.target.value)}
            className="w-full pr-14 pl-6 py-4 rounded-2xl border border-slate-100 bg-white text-slate-900 font-medium placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all shadow-sm" />
        </div>

        <QueryStateHandler
          loading={loading}
          error={error}
          data={allParents}
          onRetry={refetch}
          isRefetching={isRefetching}
          loadingMessage="جاري مزامنة بيانات أولياء الأمور..."
          errorMessage="فشل تحميل قائمة أولياء الأمور."
          isEmpty={filtered.length === 0}
        >
          <div className="space-y-10">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                {totalItems} ولي أمر — الصفحة {page}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {paginated.map(p => (
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
function ParentCard({ parent, onClick }: { parent: ParentProfile; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col text-right group h-full transition-all">
      <div className="bg-white border border-slate-100 rounded-3xl p-6 flex flex-col flex-1 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 hover:translate-y-[-4px] transition-all w-full relative overflow-hidden">
        <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary mb-4 group-hover:bg-primary group-hover:text-white transition-all">
          <User className="w-6 h-6" />
        </div>
        
        <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-primary transition-colors">{parent.full_name || '...'}</h3>

        <div className="pt-5 mt-5 border-t border-slate-50 w-full flex justify-center">
          <span className="text-[11px] font-bold text-primary uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
            استعراض الملف الشخصي
          </span>
        </div>
      </div>
    </button>
  );
}
