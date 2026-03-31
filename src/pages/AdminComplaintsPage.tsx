import { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  MessageSquare, Search, Filter, Clock, CheckCircle, 
  AlertCircle, ChevronLeft, MoreHorizontal, User,
  Mail, Phone, Shield, ArrowUpRight, History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface Complaint {
  id: string;
  parent_id: string;
  student_id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'resolved';
  created_at: string;
  parent_name?: string;
  student_name?: string;
}

export default function AdminComplaintsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('الكل');

  useEffect(() => {
    const fetchComplaints = async () => {
      setLoading(true);
      // Fetch complaints and profiles separately for reliability
      const { data: complaintsData, error } = await supabase.from('complaints').select(`
        *,
        students(name)
      `).eq('school_id', user?.schoolId).order('created_at', { ascending: false });

      if (error) {
        toast({ title: 'خطأ', description: 'فشل في تحميل الشكاوى', variant: 'destructive' });
      } else {
        // Fetch profiles for parent names
        const parentIds = [...new Set(complaintsData.map(c => c.parent_id))].filter(Boolean) as string[];
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').eq('school_id', user?.schoolId).in('id', parentIds);

        const enriched = complaintsData.map((c: any) => ({
          ...c,
          parent_name: profiles?.find(p => p.id === c.parent_id)?.full_name || 'ولي أمر',
          student_name: c.students?.name || 'غير محدد',
        }));
        setComplaints(enriched);
      }
      setLoading(false);
    };
    fetchComplaints();
  }, [toast]);

  const updateStatus = async (id: string, status: Complaint['status']) => {
    const { error } = await supabase.from('complaints').update({ status }).eq('id', id);
    if (error) {
      toast({ title: 'خطأ', description: 'فشل تدويل الحالة', variant: 'destructive' });
    } else {
      setComplaints(prev => prev.map(c => c.id === id ? { ...c, status } : c));
      toast({ title: 'تم التحديث بنجاح' });
    }
  };

  const filtered = complaints.filter(c => {
    const matchSearch = c.content.includes(search) || c.parent_name?.includes(search);
    const matchStatus = filterStatus === 'الكل' || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1400px] mx-auto text-right pb-10">
        {/* Premium Header - Scaled Down */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/40 backdrop-blur-md p-8 rounded-[40px] border border-white/50 shadow-xl shadow-slate-200/10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="w-1.5 h-7 bg-indigo-600 rounded-full" />
               <h1 className="text-2xl font-black text-slate-900 tracking-tight">مركز الشكاوى والمقترحات</h1>
            </div>
            <p className="text-slate-500 font-medium text-sm pr-4">إدارة بلاغات أولياء الأمور وحلها لضمان جودة التعليم</p>
          </div>
          
          <div className="flex items-center gap-4">
             {/* Dynamic counts could go here later if needed */}
          </div>
        </header>

        {/* Filters & KPI - Scaled Down */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-center">
           <div className="lg:col-span-2 relative group w-full text-right">
              <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
              <Input 
                placeholder="بحث بالعنوان أو اسم ولي الأمر..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-12 pr-12 pl-6 rounded-[20px] border-none bg-white text-sm font-bold shadow-sm transition-all focus:ring-4 focus:ring-indigo-600/5" 
              />
           </div>
           
           <div className="lg:col-span-2 flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide justify-end">
              {['الكل', 'pending', 'in_progress', 'resolved'].map(status => (
                <button key={status} onClick={() => setFilterStatus(status)}
                  className={cn(
                    "px-5 py-2 rounded-xl text-[10px] font-black whitespace-nowrap transition-all border shadow-sm",
                    filterStatus === status ? "bg-slate-900 border-slate-900 text-white shadow-lg" : "bg-white border-white text-slate-400"
                  )}>
                  {status === 'pending' ? 'بانتظار المراجعة' : status === 'in_progress' ? 'قيد المعالجة' : status === 'resolved' ? 'تم الحل' : 'جميع الشكاوى'}
                </button>
              ))}
           </div>
        </div>

        {loading ? (
             <div className="flex flex-col items-center justify-center py-32 gap-4">
               <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
               <p className="text-slate-300 font-black tracking-widest text-[10px] uppercase">جاري استرجاع البلاغات</p>
             </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 p-24 text-center rounded-[48px] shadow-sm">
            <div className="w-20 h-20 rounded-[32px] bg-slate-50 flex items-center justify-center mx-auto mb-6 text-slate-200">
              <MessageSquare className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2">لا يوجد شكاوى حالياً</h2>
            <p className="text-slate-400 font-medium text-sm">سجلك خالٍ من البلاغات المعلقة.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filtered.map(c => (
              <ComplaintCard key={c.id} complaint={c} onStatusChange={updateStatus} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function ComplaintCard({ complaint, onStatusChange }: { complaint: Complaint; onStatusChange: (id: string, s: any) => void }) {
  const statusConfig = {
    pending: { label: 'جديد', color: 'bg-rose-50 text-rose-600', icon: AlertCircle },
    in_progress: { label: 'قيد الحل', color: 'bg-amber-50 text-amber-600', icon: Clock },
    resolved: { label: 'مكتمل', color: 'bg-emerald-50 text-emerald-600', icon: CheckCircle },
  };
  const config = statusConfig[complaint.status];

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
                   <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">بلاغ رسمي</span>
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
             <span className="text-[9px] font-black text-slate-300 uppercase">{new Date(complaint.created_at).toLocaleDateString('ar-EG')}</span>
          </div>

          <div className="flex gap-3 pt-2">
             {complaint.status !== 'resolved' && (
               <Button onClick={() => onStatusChange(complaint.id, complaint.status === 'pending' ? 'in_progress' : 'resolved')}
                 className="flex-1 h-10 rounded-xl bg-slate-900 text-white font-black hover:bg-indigo-600 transition-all text-xs gap-2">
                 <ArrowUpRight className="w-4 h-4" /> {complaint.status === 'pending' ? 'بدء المعالجة' : 'إغلاق الشكوى'}
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
