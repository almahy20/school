import { useState, useMemo, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  MessageSquare, Search, Clock, CheckCircle, 
  AlertCircle, ArrowUpRight, User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useComplaints, useUpsertComplaint, useMarkComplaintsAsRead } from '@/hooks/queries';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import DataPagination from '@/components/ui/DataPagination';
import PageHeader from '@/components/layout/PageHeader';

const PAGE_SIZE = 10;

export default function AdminComplaintsPage() {
  const { toast } = useToast();
  const { mutate: markAsRead } = useMarkComplaintsAsRead();

  useEffect(() => {
    markAsRead();
  }, [markAsRead]);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('الكل');
  const [page, setPage] = useState(1);

  // ── Debounce Search ──
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Queries ──
  const { 
    data, 
    isLoading: loading, 
    error, 
    refetch 
  } = useComplaints(page, PAGE_SIZE, debouncedSearch, filterStatus);

  const complaints = data?.data || [];
  const totalItems = data?.count || 0;

  // ── Mutations ──
  const upsertComplaintMutation = useUpsertComplaint();

  const updateStatus = async (id: string, currentContent: string, status: any) => {
    try {
      await upsertComplaintMutation.mutateAsync({ 
        id, 
        content: currentContent, // Required by schema
        status 
      });
      toast({ title: 'تم التحديث بنجاح' });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleSearch = (val: string) => { setSearch(val); setPage(1); };
  const handleFilterChange = (val: string) => { setFilterStatus(val); setPage(1); };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1400px] mx-auto text-right pb-10 px-4 md:px-0">
        <PageHeader
          icon={MessageSquare}
          title="مركز الشكاوى والمقترحات"
          subtitle="متابعة بلاغات أولياء الأمور وحلها لضمان استمرارية الجودة التعليمية"
        />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 items-center">
           <div className="lg:col-span-2 relative group w-full text-right order-2 lg:order-1">
              <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
              <Input
                placeholder="بحث بالمحتوى أو اسم ولي الأمر..."
                value={search}
                onChange={e => handleSearch(e.target.value)}
                className="h-14 pr-14 pl-6 rounded-[28px] border-none bg-white font-bold shadow-xl shadow-slate-200/20 focus:ring-4 focus:ring-indigo-600/5"
              />
           </div>
           
           <div className="lg:col-span-2 flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar justify-start lg:justify-end order-1 lg:order-2">
              {['الكل', 'pending', 'in_progress', 'resolved'].map(status => (
                <button key={status} onClick={() => handleFilterChange(status)}
                  className={cn(
                    "px-4 sm:px-5 py-2 rounded-xl text-[10px] font-black whitespace-nowrap transition-all border shadow-sm",
                    filterStatus === status ? "bg-slate-900 border-slate-900 text-white shadow-lg" : "bg-white border-white text-slate-400"
                  )}>
                  {status === 'pending' ? 'بانتظار المراجعة' : status === 'in_progress' ? 'قيد المعالجة' : status === 'resolved' ? 'تم الحل' : 'جميع الشكاوى'}
                </button>
              ))}
           </div>
        </div>

        <QueryStateHandler
          loading={loading}
          error={error}
          data={complaints}
          onRetry={refetch}
          isEmpty={complaints.length === 0}
          loadingMessage="جاري مزامنة البلاغات..."
          emptyMessage={search ? 'لم نجد نتائج مطابقة لطلبك' : 'لا توجد شكاوى معلقة حالياً'}
        >
          <div className="space-y-10">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                {totalItems} بلاغ متاح — الصفحة {page}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {complaints.map(c => (
                <ComplaintCard key={c.id} complaint={c} onStatusChange={updateStatus} isUpdating={upsertComplaintMutation.isPending} />
              ))}
            </div>

            <div className="pt-4">
              <DataPagination
                currentPage={page}
                totalItems={totalItems}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          </div>
        </QueryStateHandler>
      </div>
    </AppLayout>
  );
}

function ComplaintCard({ complaint, onStatusChange, isUpdating }: { complaint: any; onStatusChange: (id: string, content: string, s: any) => void, isUpdating: boolean }) {
  const statusConfig: any = {
    pending: { label: 'جديد', color: 'bg-rose-50 text-rose-600', icon: AlertCircle },
    in_progress: { label: 'قيد الحل', color: 'bg-amber-50 text-amber-600', icon: Clock },
    processing: { label: 'قيد المعالجة', color: 'bg-amber-50 text-amber-600', icon: Clock },
    resolved: { label: 'مكتمل', color: 'bg-emerald-50 text-emerald-600', icon: CheckCircle },
  };
  const config = statusConfig[complaint.status] || statusConfig.pending;

  return (
    <div className="group premium-card p-0 overflow-hidden hover:translate-y-[-4px] transition-all duration-500 text-right">
       <div className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
             <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 rounded-xl group-hover:rotate-3 transition-transform">
                   <AvatarFallback className="bg-slate-50 text-slate-400 text-xs font-black">{complaint.parent_name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                   <h3 className="text-sm font-black text-slate-900 truncate leading-none mb-1.5">{complaint.parent_name}</h3>
                   <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">بلاغ في {new Date(complaint.created_at).toLocaleDateString('ar-EG')}</span>
                </div>
             </div>
             <Badge className={cn("px-3 py-1 rounded-lg font-black text-[9px] border-none", config.color)}>
                {config.label}
             </Badge>
          </div>

          <div className="space-y-2 min-h-[60px]">
             <p className="text-xs text-slate-600 font-bold leading-relaxed line-clamp-4 whitespace-pre-wrap">{complaint.content}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
             <div className="flex items-center gap-4">
                <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest">بخصوص الطالب</div>
                <div className="text-[10px] font-black text-slate-900">{complaint.student_name}</div>
             </div>
          </div>

          <div className="flex gap-3 pt-2">
             {complaint.status !== 'resolved' && (
               <Button 
                 onClick={() => onStatusChange(complaint.id, complaint.content, complaint.status === 'pending' ? 'in_progress' : 'resolved')}
                 disabled={isUpdating}
                 className="flex-1 h-10 rounded-xl bg-slate-900 text-white font-black hover:bg-indigo-600 transition-all text-xs gap-2"
               >
                 <ArrowUpRight className="w-4 h-4" /> {isUpdating ? 'جاري التحديث...' : complaint.status === 'pending' ? 'بدء المعالجة' : 'إغلاق الشكوى'}
               </Button>
             )}
             <Button variant="ghost" className="h-10 px-4 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-900 transition-all text-xs border border-transparent hover:border-slate-100">
                التفاصيل
             </Button>
          </div>
       </div>
    </div>
  );
}
